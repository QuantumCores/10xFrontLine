namespace frontLineApi.Middleware;

public sealed class CorrelationIdMiddleware(RequestDelegate next, ILogger<CorrelationIdMiddleware> logger)
{
    public const string HeaderName = "X-Correlation-ID";
    private const int MaximumCorrelationIdLength = 64;

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = GetCorrelationId(context);
        context.TraceIdentifier = correlationId;
        context.Response.OnStarting(() =>
        {
            context.Response.Headers[HeaderName] = correlationId;
            return Task.CompletedTask;
        });

        using (logger.BeginScope(new Dictionary<string, object>
        {
            ["CorrelationId"] = correlationId
        }))
        {
            await next(context);
        }
    }

    private static string GetCorrelationId(HttpContext context)
    {
        if (context.Request.Headers.TryGetValue(HeaderName, out var values) &&
            values.Count == 1 &&
            IsSafe(values[0]))
        {
            return values[0]!;
        }

        return Guid.NewGuid().ToString("N");
    }

    private static bool IsSafe(string? value)
    {
        return value is { Length: > 0 and <= MaximumCorrelationIdLength } &&
            value.All(character => char.IsAsciiLetterOrDigit(character) || character is '-' or '_' or '.');
    }
}
