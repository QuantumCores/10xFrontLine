namespace frontLineApi.Configuration;

public sealed class CorsOptions
{
    public const string SectionName = "Cors";

    public string[] AllowedOrigins { get; set; } = [];

    public static bool HasExplicitOrigins(CorsOptions options)
    {
        return options.AllowedOrigins.Length > 0 &&
            options.AllowedOrigins.All(IsExplicitHttpOrigin);
    }

    private static bool IsExplicitHttpOrigin(string origin)
    {
        return Uri.TryCreate(origin, UriKind.Absolute, out var uri) &&
            (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps) &&
            string.IsNullOrEmpty(uri.PathAndQuery.Trim('/')) &&
            string.IsNullOrEmpty(uri.Fragment) &&
            string.IsNullOrEmpty(uri.UserInfo) &&
            !origin.Contains('*', StringComparison.Ordinal);
    }
}
