namespace frontLineApi.Configuration;

public sealed class E2eOptions
{
    public const string SectionName = "E2E";
    public const int MinimumAccessKeyLength = 43;

    public string AccessKey { get; set; } = string.Empty;

    public static bool HasValidAccessKey(E2eOptions options)
    {
        return !string.IsNullOrWhiteSpace(options.AccessKey) &&
            options.AccessKey.Length >= MinimumAccessKeyLength &&
            !options.AccessKey.Contains("placeholder", StringComparison.OrdinalIgnoreCase) &&
            !options.AccessKey.Contains("change-me", StringComparison.OrdinalIgnoreCase);
    }
}
