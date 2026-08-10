namespace frontLineApi.Configuration;

public sealed class HttpsRedirectionOptions
{
    public const string SectionName = "HttpsRedirection";

    public bool Enabled { get; set; }
}
