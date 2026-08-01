using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace frontLineApi.Tests.Auth;

internal static class TestJwtFactory
{
    private const string Issuer = "FrontLine.Tests";
    private const string Audience = "FrontLine.Tests.Client";
    private const string SigningKey = "test-signing-key-with-enough-entropy-for-hmac-sha256";

    public static string Create(
        Guid playerId,
        DateTimeOffset notBefore,
        DateTimeOffset expires,
        string signingKey = SigningKey)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey))
        {
            KeyId = "frontline-auth"
        };
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim("player_id", playerId.ToString()),
            new Claim(JwtRegisteredClaimNames.Sub, playerId.ToString()),
            new Claim(ClaimTypes.NameIdentifier, playerId.ToString())
        };
        var token = new JwtSecurityToken(
            issuer: Issuer,
            audience: Audience,
            claims: claims,
            notBefore: notBefore.UtcDateTime,
            expires: expires.UtcDateTime,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
