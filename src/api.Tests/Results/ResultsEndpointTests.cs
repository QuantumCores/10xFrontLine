using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using frontLineApi.Contracts.Auth;
using frontLineApi.Contracts.Results;
using frontLineApi.Email;
using frontLineApi.Tests.Auth;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace frontLineApi.Tests.Results;

public sealed class ResultsEndpointTests
{
    [Fact]
    public async Task SaveCompletedResultRejectsUnauthenticatedRequest()
    {
        await using var factory = new AuthWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/results", CreateValidRequest());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task SaveCompletedResultPersistsAuthenticatedResult()
    {
        await using var factory = new AuthWebApplicationFactory();
        using var client = factory.CreateClient();
        await AuthenticateAsync(factory, client);

        var request = CreateValidRequest();
        var response = await client.PostAsJsonAsync("/api/results", request);
        var body = await response.Content.ReadFromJsonAsync<CompletedResultResponse>();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(body);
        Assert.NotEqual(Guid.Empty, body.ResultId);
        Assert.Equal(request.ClientMatchId, body.ClientMatchId);
        Assert.Equal(request.Outcome, body.Outcome);
        Assert.True(body.SavedAt > DateTimeOffset.UtcNow.AddMinutes(-1));
    }

    [Fact]
    public async Task SaveCompletedResultRejectsInvalidPayload()
    {
        await using var factory = new AuthWebApplicationFactory();
        using var client = factory.CreateClient();
        await AuthenticateAsync(factory, client);

        var response = await client.PostAsJsonAsync(
            "/api/results",
            CreateValidRequest(outcome: "Unknown", durationSeconds: 0));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SaveCompletedResultReturnsExistingResultForIdenticalDuplicate()
    {
        await using var factory = new AuthWebApplicationFactory();
        using var client = factory.CreateClient();
        await AuthenticateAsync(factory, client);

        var request = CreateValidRequest();
        var firstResponse = await client.PostAsJsonAsync("/api/results", request);
        var firstBody = await firstResponse.Content.ReadFromJsonAsync<CompletedResultResponse>();
        var secondResponse = await client.PostAsJsonAsync("/api/results", request);
        var secondBody = await secondResponse.Content.ReadFromJsonAsync<CompletedResultResponse>();

        Assert.Equal(HttpStatusCode.Created, firstResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, secondResponse.StatusCode);
        Assert.NotNull(firstBody);
        Assert.NotNull(secondBody);
        Assert.Equal(firstBody.ResultId, secondBody.ResultId);
        Assert.Equal(firstBody.SavedAt, secondBody.SavedAt);
    }

    [Fact]
    public async Task SaveCompletedResultRejectsDifferentDuplicate()
    {
        await using var factory = new AuthWebApplicationFactory();
        using var client = factory.CreateClient();
        await AuthenticateAsync(factory, client);

        var request = CreateValidRequest();
        var firstResponse = await client.PostAsJsonAsync("/api/results", request);
        var secondResponse = await client.PostAsJsonAsync(
            "/api/results",
            request with { FinalScore = request.FinalScore + 1 });

        Assert.Equal(HttpStatusCode.Created, firstResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, secondResponse.StatusCode);
    }

    private static CompletedResultRequest CreateValidRequest(
        string clientMatchId = "match-001",
        string outcome = "Victory",
        int durationSeconds = 135,
        int finalScore = 42,
        int finalFrontlinePosition = 100)
    {
        return new CompletedResultRequest(
            clientMatchId,
            outcome,
            durationSeconds,
            DateTimeOffset.UtcNow.AddSeconds(-5),
            finalScore,
            finalFrontlinePosition);
    }

    private static async Task AuthenticateAsync(AuthWebApplicationFactory factory, HttpClient client)
    {
        const string email = "player@example.com";

        var requestCodeResponse = await client.PostAsJsonAsync(
            "/api/auth/request-code",
            new RequestCodeRequest(email));
        requestCodeResponse.EnsureSuccessStatusCode();

        var verifyCodeResponse = await client.PostAsJsonAsync(
            "/api/auth/verify-code",
            new VerifyCodeRequest(email, GetCapturedCode(factory)));
        verifyCodeResponse.EnsureSuccessStatusCode();

        var token = await verifyCodeResponse.Content.ReadFromJsonAsync<VerifyCodeResponse>();
        Assert.NotNull(token);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.Token);
    }

    private static string GetCapturedCode(AuthWebApplicationFactory factory)
    {
        var store = factory.Services.GetRequiredService<CapturedEmailStore>();
        var message = Assert.Single(store.Messages);
        var match = Regex.Match(message.Body, @"\b\d{6}\b");

        Assert.True(match.Success, "Expected captured email body to contain a six-digit code.");
        return match.Value;
    }
}
