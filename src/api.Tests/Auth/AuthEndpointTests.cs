using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using frontLineApi.Contracts.Auth;
using frontLineApi.Email;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace frontLineApi.Tests.Auth;

public sealed class AuthEndpointTests
{
    [Fact]
    public async Task RequestCodeReturnsGenericResponse()
    {
        await using var factory = new AuthWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/request-code",
            new RequestCodeRequest("player@example.com"));

        var body = await response.Content.ReadFromJsonAsync<RequestCodeResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(body);
        Assert.DoesNotContain("player@example.com", body.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task VerifyCodeReturnsJwt()
    {
        await using var factory = new AuthWebApplicationFactory();
        using var client = factory.CreateClient();

        await RequestCodeAsync(client, "player@example.com");
        var code = GetCapturedCode(factory);

        var response = await client.PostAsJsonAsync(
            "/api/auth/verify-code",
            new VerifyCodeRequest("player@example.com", code));
        var body = await response.Content.ReadFromJsonAsync<VerifyCodeResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(body);
        Assert.False(string.IsNullOrWhiteSpace(body.Token));
        Assert.Equal("player@example.com", body.Player.Email);
        Assert.True(body.ExpiresAt > DateTimeOffset.UtcNow);
    }

    [Fact]
    public async Task VerifyCodeAcceptsDifferentLetterCasing()
    {
        await using var factory = new AuthWebApplicationFactory();
        using var client = factory.CreateClient();

        await RequestCodeAsync(client, "player@example.com");
        var code = GetCapturedCode(factory).ToLowerInvariant();

        var response = await client.PostAsJsonAsync(
            "/api/auth/verify-code",
            new VerifyCodeRequest("player@example.com", code));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task VerifyCodeRejectsInvalidCode()
    {
        await using var factory = new AuthWebApplicationFactory();
        using var client = factory.CreateClient();

        await RequestCodeAsync(client, "player@example.com");

        var response = await client.PostAsJsonAsync(
            "/api/auth/verify-code",
            new VerifyCodeRequest("player@example.com", "not-a-code"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task VerifyCodeRejectsConsumedCode()
    {
        await using var factory = new AuthWebApplicationFactory();
        using var client = factory.CreateClient();

        await RequestCodeAsync(client, "player@example.com");
        var code = GetCapturedCode(factory);

        var firstResponse = await client.PostAsJsonAsync(
            "/api/auth/verify-code",
            new VerifyCodeRequest("player@example.com", code));
        var secondResponse = await client.PostAsJsonAsync(
            "/api/auth/verify-code",
            new VerifyCodeRequest("player@example.com", code));

        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, secondResponse.StatusCode);
    }

    [Fact]
    public async Task VerifyCodeRejectsExpiredCode()
    {
        await using var factory = new AuthWebApplicationFactory(codeMinutes: 0);
        using var client = factory.CreateClient();

        await RequestCodeAsync(client, "player@example.com");
        var code = GetCapturedCode(factory);

        var response = await client.PostAsJsonAsync(
            "/api/auth/verify-code",
            new VerifyCodeRequest("player@example.com", code));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private static async Task RequestCodeAsync(HttpClient client, string email)
    {
        var response = await client.PostAsJsonAsync(
            "/api/auth/request-code",
            new RequestCodeRequest(email));

        response.EnsureSuccessStatusCode();
    }

    private static string GetCapturedCode(AuthWebApplicationFactory factory)
    {
        var store = factory.Services.GetRequiredService<CapturedEmailStore>();
        var message = Assert.Single(store.Messages);
        var match = Regex.Match(message.Body, @"\b[A-Z0-9]{8}\b");

        Assert.True(match.Success, "Expected captured email body to contain an eight-character alphanumeric code.");
        return match.Value;
    }
}
