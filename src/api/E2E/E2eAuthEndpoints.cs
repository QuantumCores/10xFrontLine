using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using frontLineApi.Configuration;
using frontLineApi.Email;
using Microsoft.Extensions.Options;
using HttpResults = Microsoft.AspNetCore.Http.Results;

namespace frontLineApi.E2E;

public static partial class E2eAuthEndpoints
{
    private const string AccessKeyHeader = "X-FrontLine-E2E-Key";
    private static readonly EmailAddressAttribute EmailValidator = new();

    public static IEndpointRouteBuilder MapE2eAuthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost(
            "/api/e2e/auth/login-code",
            (E2eLoginCodeRequest request,
                HttpContext context,
                CapturedEmailStore capturedEmails,
                IOptions<E2eOptions> options) =>
            {
                if (!IsLoopback(context.Connection.RemoteIpAddress))
                {
                    return HttpResults.Forbid();
                }

                if (!HasValidAccessKey(context.Request, options.Value.AccessKey))
                {
                    return HttpResults.Unauthorized();
                }

                if (!IsValidEmail(request.Email))
                {
                    return HttpResults.BadRequest();
                }

                var message = capturedEmails.TakeLatestSignInCode(request.Email);
                if (message is null)
                {
                    return HttpResults.NotFound();
                }

                var match = LoginCodePattern().Match(message.Body);
                if (!match.Success)
                {
                    return HttpResults.NotFound();
                }

                context.Response.Headers.CacheControl = "no-store";
                return HttpResults.Ok(new E2eLoginCodeResponse(match.Value));
            });

        return endpoints;
    }

    private static bool IsLoopback(IPAddress? remoteAddress)
    {
        return remoteAddress is not null && IPAddress.IsLoopback(remoteAddress);
    }

    private static bool HasValidAccessKey(HttpRequest request, string expectedAccessKey)
    {
        if (!request.Headers.TryGetValue(AccessKeyHeader, out var suppliedValues) ||
            suppliedValues.Count != 1)
        {
            return false;
        }

        var suppliedHash = SHA256.HashData(Encoding.UTF8.GetBytes(suppliedValues[0]!));
        var expectedHash = SHA256.HashData(Encoding.UTF8.GetBytes(expectedAccessKey));
        return CryptographicOperations.FixedTimeEquals(suppliedHash, expectedHash);
    }

    private static bool IsValidEmail(string? email)
    {
        return !string.IsNullOrWhiteSpace(email) &&
            email.Length <= 320 &&
            EmailValidator.IsValid(email.Trim());
    }

    [GeneratedRegex(@"\b[A-Z0-9]{8}\b", RegexOptions.CultureInvariant)]
    private static partial Regex LoginCodePattern();
}

public sealed record E2eLoginCodeRequest(string Email);

public sealed record E2eLoginCodeResponse(string Code);
