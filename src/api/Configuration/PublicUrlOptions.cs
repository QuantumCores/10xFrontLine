namespace frontLineApi.Configuration;

public sealed class PublicUrlOptions
{
    public string Value { get; set; } = string.Empty;

    public static bool IsValid(PublicUrlOptions options)
    {
        return Uri.TryCreate(options.Value, UriKind.Absolute, out var uri) &&
            (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps) &&
            string.IsNullOrEmpty(uri.PathAndQuery.Trim('/')) &&
            string.IsNullOrEmpty(uri.Fragment) &&
            string.IsNullOrEmpty(uri.UserInfo);
    }
}
