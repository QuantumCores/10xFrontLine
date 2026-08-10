using System.Text.Json;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace frontLineApi.Health;

public static class HealthResponseWriter
{
    public static Task WriteMinimalJsonAsync(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json; charset=utf-8";
        return JsonSerializer.SerializeAsync(
            context.Response.Body,
            new { status = report.Status.ToString().ToLowerInvariant() },
            cancellationToken: context.RequestAborted);
    }
}
