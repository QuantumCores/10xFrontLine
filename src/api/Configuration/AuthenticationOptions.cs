namespace frontLineApi.Configuration;

public sealed class AuthenticationOptions
{
    public string Issuer { get; set; } = string.Empty;

    public string Audience { get; set; } = string.Empty;

    public string SigningKey { get; set; } = string.Empty;

    public int TokenMinutes { get; set; } = 60;
}
