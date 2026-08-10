using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Logging;
using Xunit;

namespace frontLineApi.Tests.Foundation;

public sealed class ProductionInfrastructureTests
{
    [Theory]
    [InlineData("/health/live")]
    [InlineData("/health/ready")]
    public async Task HealthEndpointsReturnMinimalStatus(string path)
    {
        await using var factory = CreateFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync(path);
        var body = await response.Content.ReadFromJsonAsync<HealthResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("healthy", body?.Status);
    }

    [Fact]
    public async Task CorrelationIdIsReturnedWhenItIsSafe()
    {
        await using var factory = CreateFactory();
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/health/live");
        request.Headers.Add("X-Correlation-ID", "deployment-check-42");

        var response = await client.SendAsync(request);

        Assert.Equal("deployment-check-42", response.Headers.GetValues("X-Correlation-ID").Single());
    }

    [Fact]
    public async Task UnsafeCorrelationIdIsReplaced()
    {
        await using var factory = CreateFactory();
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/health/live");
        request.Headers.Add("X-Correlation-ID", "unsafe value with spaces");

        var response = await client.SendAsync(request);
        var returnedId = response.Headers.GetValues("X-Correlation-ID").Single();

        Assert.NotEqual("unsafe value with spaces", returnedId);
        Assert.Matches("^[a-f0-9]{32}$", returnedId);
    }

    private static WebApplicationFactory<Program> CreateFactory()
    {
        return new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Testing");
                builder.ConfigureLogging(logging => logging.ClearProviders());
            });
    }

    private sealed record HealthResponse(string Status);
}
