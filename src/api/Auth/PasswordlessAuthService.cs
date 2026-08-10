using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using frontLineApi.Configuration;
using frontLineApi.Contracts.Auth;
using frontLineApi.Data;
using frontLineApi.Data.Entities;
using frontLineApi.Email;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace frontLineApi.Auth;

public sealed class PasswordlessAuthService(
    FrontLineDbContext dbContext,
    IEmailSender emailSender,
    IOptions<AuthenticationOptions> authenticationOptions,
    IOptions<PasswordlessOptions> passwordlessOptions,
    TimeProvider timeProvider) : IPasswordlessAuthService
{
    private const string SigningKeyId = "frontline-auth";
    private const string CodeAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private const int CodeLength = 8;
    private const int CodeSaltByteCount = 32;
    private readonly AuthenticationOptions _authentication = authenticationOptions.Value;
    private readonly PasswordlessOptions _passwordless = passwordlessOptions.Value;

    public async Task RequestCodeAsync(RequestCodeRequest request, CancellationToken cancellationToken)
    {
        var email = NormalizeEmail(request.Email);
        var now = timeProvider.GetUtcNow();
        var player = await dbContext.Players.SingleOrDefaultAsync(
            existingPlayer => existingPlayer.Email == email,
            cancellationToken);

        if (player is null)
        {
            player = new Player
            {
                Email = email,
                CreatedAt = now
            };
            dbContext.Players.Add(player);
        }

        var code = GenerateCode();
        var codeSalt = CreateSalt();
        var loginCode = new PasswordlessLoginCode
        {
            Player = player,
            Email = email,
            CodeHash = HashCode(email, code, codeSalt, _passwordless.CodePepper),
            CodeSalt = codeSalt,
            CreatedAt = now,
            ExpiresAt = now.AddMinutes(Math.Max(0, _passwordless.CodeMinutes))
        };

        dbContext.PasswordlessLoginCodes.Add(loginCode);
        await dbContext.SaveChangesAsync(cancellationToken);

        await emailSender.SendAsync(
            new EmailMessage(email, "Your Front Line sign-in code", $"Your Front Line code is {code}."),
            cancellationToken);
    }

    public async Task<VerifyCodeResponse?> VerifyCodeAsync(VerifyCodeRequest request, CancellationToken cancellationToken)
    {
        var email = NormalizeEmail(request.Email);
        var now = timeProvider.GetUtcNow();

        var loginCode = await dbContext.PasswordlessLoginCodes
            .Include(candidate => candidate.Player)
            .Where(candidate =>
                candidate.Email == email &&
                candidate.ConsumedAt == null &&
                candidate.ExpiresAt > now)
            .OrderByDescending(candidate => candidate.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (loginCode?.Player is null ||
            !FixedTimeEquals(
                loginCode.CodeHash,
                HashCode(email, request.Code.Trim(), loginCode.CodeSalt, _passwordless.CodePepper)))
        {
            return null;
        }

        loginCode.ConsumedAt = now;
        await dbContext.SaveChangesAsync(cancellationToken);

        var expiresAt = now.AddMinutes(Math.Max(1, _authentication.TokenMinutes));
        var token = CreateJwt(loginCode.Player, expiresAt);

        return new VerifyCodeResponse(
            token,
            expiresAt,
            new AuthPlayerResponse(loginCode.Player.Id, loginCode.Player.Email));
    }

    private string CreateJwt(Player player, DateTimeOffset expiresAt)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_authentication.SigningKey))
        {
            KeyId = SigningKeyId
        };
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim("player_id", player.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Sub, player.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, player.Email),
            new Claim(ClaimTypes.NameIdentifier, player.Id.ToString())
        };

        var token = new JwtSecurityToken(
            issuer: _authentication.Issuer,
            audience: _authentication.Audience,
            claims: claims,
            expires: expiresAt.UtcDateTime,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string NormalizeEmail(string email)
    {
        return email.Trim().ToLowerInvariant();
    }

    private static string CreateSalt()
    {
        return Convert.ToHexString(RandomNumberGenerator.GetBytes(CodeSaltByteCount));
    }

    private static string GenerateCode()
    {
        Span<char> code = stackalloc char[CodeLength];
        for (var index = 0; index < code.Length; index++)
        {
            code[index] = CodeAlphabet[RandomNumberGenerator.GetInt32(CodeAlphabet.Length)];
        }

        return code.ToString();
    }

    private static string HashCode(string email, string code, string salt, string pepper)
    {
        if (string.IsNullOrWhiteSpace(pepper))
        {
            throw new InvalidOperationException("Passwordless:CodePepper must be configured.");
        }

        var normalizedCode = code.Trim().ToUpperInvariant();
        var bytes = HMACSHA256.HashData(
            Encoding.UTF8.GetBytes(pepper),
            Encoding.UTF8.GetBytes($"{salt}:{email}:{normalizedCode}"));
        return Convert.ToHexString(bytes);
    }

    private static bool FixedTimeEquals(string first, string second)
    {
        var firstBytes = Convert.FromHexString(first);
        var secondBytes = Convert.FromHexString(second);

        return firstBytes.Length == secondBytes.Length &&
            CryptographicOperations.FixedTimeEquals(firstBytes, secondBytes);
    }
}
