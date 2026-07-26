using System.Net;
using System.Net.Http.Json;
using frontLineApi.Contracts.Auth;
using frontLineApi.Email;
using frontLineApi.E2E;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;
using Xunit;

namespace frontLineApi.Tests.E2E;

public sealed class E2eLoginCodeEndpointTests
{
    private const string Endpoint = "/api/e2e/auth/login-code";

    [Fact]
    public async Task RetrievedCodeCompletesNormalAuthenticationFlow()
    {
        await using var factory = new E2eWebApplicationFactory();
        using var client = factory.CreateClient();

        var requestResponse = await RequestCodeAsync(client, "player@example.com");
        var retrievalResponse = await RetrieveCodeAsync(client, "player@example.com");
        var retrieval = await retrievalResponse.Content.ReadFromJsonAsync<E2eLoginCodeResponse>();
        var verifyResponse = await client.PostAsJsonAsync(
            "/api/auth/verify-code",
            new VerifyCodeRequest("player@example.com", retrieval!.Code));
        var verified = await verifyResponse.Content.ReadFromJsonAsync<VerifyCodeResponse>();

        Assert.Equal(HttpStatusCode.OK, requestResponse.StatusCode);
        Assert.NotNull(await requestResponse.Content.ReadFromJsonAsync<RequestCodeResponse>());
        Assert.Equal(HttpStatusCode.OK, retrievalResponse.StatusCode);
        Assert.NotNull(verified);
        Assert.False(string.IsNullOrWhiteSpace(verified.Token));
        Assert.Equal("player@example.com", verified.Player.Email);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("wrong-key")]
    public async Task RetrievalRejectsMissingOrIncorrectAccessKey(string? accessKey)
    {
        await using var factory = new E2eWebApplicationFactory();
        using var client = factory.CreateClient();
        await RequestCodeAsync(client, "player@example.com");

        var response = await RetrieveCodeAsync(client, "player@example.com", accessKey);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.NotEmpty(factory.Services.GetRequiredService<CapturedEmailStore>().Messages);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    [InlineData("player@@example.com")]
    public async Task RetrievalRejectsInvalidEmail(string email)
    {
        await using var factory = new E2eWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await RetrieveCodeAsync(client, email);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task RetrievalReturnsNotFoundForAbsentOrMismatchedRecipient()
    {
        await using var factory = new E2eWebApplicationFactory();
        using var client = factory.CreateClient();
        await RequestCodeAsync(client, "player@example.com");

        var response = await RetrieveCodeAsync(client, "other@example.com");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task RetrievalNormalizesRecipientAndIsOneShot()
    {
        await using var factory = new E2eWebApplicationFactory();
        using var client = factory.CreateClient();
        await RequestCodeAsync(client, "player@example.com");

        var first = await RetrieveCodeAsync(client, "  PLAYER@EXAMPLE.COM  ");
        var second = await RetrieveCodeAsync(client, "player@example.com");

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, second.StatusCode);
    }

    [Fact]
    public async Task RetrievalReturnsNewestIssuanceAndPurgesOlderCaptures()
    {
        await using var factory = new E2eWebApplicationFactory();
        using var client = factory.CreateClient();
        await RequestCodeAsync(client, "player@example.com");
        var store = factory.Services.GetRequiredService<CapturedEmailStore>();
        var olderMessage = Assert.Single(store.Messages);
        await RequestCodeAsync(client, "player@example.com");
        var newestMessage = store.Messages[^1];

        var response = await RetrieveCodeAsync(client, "player@example.com");
        var result = await response.Content.ReadFromJsonAsync<E2eLoginCodeResponse>();

        Assert.Equal(CodeFrom(newestMessage), result!.Code);
        Assert.NotEqual(CodeFrom(olderMessage), result.Code);
        Assert.Empty(store.Messages);
    }

    [Fact]
    public async Task RetrievalPreservesOtherRecipients()
    {
        await using var factory = new E2eWebApplicationFactory();
        using var client = factory.CreateClient();
        await RequestCodeAsync(client, "first@example.com");
        await RequestCodeAsync(client, "second@example.com");

        var first = await RetrieveCodeAsync(client, "first@example.com");
        var second = await RetrieveCodeAsync(client, "second@example.com");

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
    }

    [Fact]
    public async Task SuccessfulRetrievalIsNotCacheable()
    {
        await using var factory = new E2eWebApplicationFactory();
        using var client = factory.CreateClient();
        await RequestCodeAsync(client, "player@example.com");

        var response = await RetrieveCodeAsync(client, "player@example.com");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task RetrievalRejectsNonLoopbackCaller()
    {
        await using var factory = new E2eWebApplicationFactory(remoteIpAddress: IPAddress.Parse("192.0.2.10"));
        using var client = factory.CreateClient();

        var response = await RetrieveCodeAsync(client, "player@example.com");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("too-short")]
    [InlineData("change-me-placeholder-access-key-that-is-long-enough")]
    public void E2eStartupRejectsInvalidAccessKey(string? accessKey)
    {
        using var factory = new E2eWebApplicationFactory(accessKey);

        Assert.Throws<OptionsValidationException>(() => factory.Server);
    }

    [Theory]
    [InlineData("Testing")]
    [InlineData("Development")]
    public async Task RouteIsAbsentOutsideExactE2e(string environment)
    {
        await using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment(environment);
                builder.ConfigureLogging(logging => logging.ClearProviders());
            });
        using var client = factory.CreateClient();

        var response = await RetrieveCodeAsync(client, "player@example.com");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task NormalRequestCodeResponseRemainsGeneric()
    {
        await using var factory = new E2eWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await RequestCodeAsync(client, "player@example.com");
        var body = await response.Content.ReadFromJsonAsync<RequestCodeResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(body);
        Assert.DoesNotContain("player@example.com", body.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("If the email can access Front Line, a sign-in code will be sent.", body.Message);
    }

    private static async Task<HttpResponseMessage> RequestCodeAsync(HttpClient client, string email)
    {
        return await client.PostAsJsonAsync(
            "/api/auth/request-code",
            new RequestCodeRequest(email));
    }

    private static async Task<HttpResponseMessage> RetrieveCodeAsync(
        HttpClient client,
        string email,
        string? accessKey = E2eWebApplicationFactory.ValidAccessKey)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, Endpoint)
        {
            Content = JsonContent.Create(new E2eLoginCodeRequest(email))
        };
        if (accessKey is not null)
        {
            request.Headers.Add("X-FrontLine-E2E-Key", accessKey);
        }

        return await client.SendAsync(request);
    }

    private static string CodeFrom(EmailMessage message)
    {
        return message.Body.Split(' ', StringSplitOptions.RemoveEmptyEntries)[^1].TrimEnd('.');
    }
}
