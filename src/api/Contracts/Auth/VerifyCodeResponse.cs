namespace frontLineApi.Contracts.Auth;

public sealed record VerifyCodeResponse(
    string Token,
    DateTimeOffset ExpiresAt,
    AuthPlayerResponse Player);
