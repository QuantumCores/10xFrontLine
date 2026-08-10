namespace frontLineApi.Configuration;

public sealed class EmailOptions
{
    public const string SectionName = "Email";

    public string Host { get; set; } = string.Empty;

    public int Port { get; set; } = 25;

    public bool UseStartTls { get; set; }

    public string Username { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;

    public string From { get; set; } = string.Empty;

    public int TimeoutSeconds { get; set; } = 15;

    public int MaxRetryAttempts { get; set; } = 3;

    public int RetryBaseDelayMilliseconds { get; set; } = 500;

    public static bool IsValid(EmailOptions options)
    {
        return string.Equals(options.Host, "smtp.gmail.com", StringComparison.OrdinalIgnoreCase) &&
            options.Port == 587 &&
            options.UseStartTls &&
            IsEmailAddress(options.Username) &&
            !string.IsNullOrWhiteSpace(options.Password) &&
            IsEmailAddress(options.From) &&
            options.TimeoutSeconds is >= 1 and <= 60 &&
            options.MaxRetryAttempts is >= 1 and <= 5 &&
            options.RetryBaseDelayMilliseconds is >= 1 and <= 10_000;
    }

    private static bool IsEmailAddress(string value)
    {
        try
        {
            return new System.Net.Mail.MailAddress(value).Address == value;
        }
        catch (FormatException)
        {
            return false;
        }
    }
}
