namespace frontLineApi.Configuration;

public sealed class EmailOptions
{
    public string Host { get; set; } = string.Empty;

    public int Port { get; set; } = 25;

    public bool UseStartTls { get; set; }

    public string Username { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;

    public string From { get; set; } = string.Empty;
}
