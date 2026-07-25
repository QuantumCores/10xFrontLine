using frontLineApi.Email;
using Xunit;

namespace frontLineApi.Tests.Email;

public sealed class CapturedEmailStoreTests
{
    private const string SignInCodeSubject = "Your Front Line sign-in code";

    [Fact]
    public void TakeLatestSignInCodeReturnsNullWhenThereIsNoMatch()
    {
        var store = new CapturedEmailStore();
        var unrelated = Message("other@example.com", "OTHER123");
        store.Add(unrelated);

        var result = store.TakeLatestSignInCode("player@example.com");

        Assert.Null(result);
        Assert.Equal([unrelated], store.Messages);
    }

    [Fact]
    public void TakeLatestSignInCodeMatchesTrimmedRecipientCaseInsensitively()
    {
        var store = new CapturedEmailStore();
        var expected = Message("  Player@Example.COM ", "MATCH123");
        store.Add(expected);

        var result = store.TakeLatestSignInCode(" player@example.com ");

        Assert.Equal(expected, result);
        Assert.Empty(store.Messages);
    }

    [Fact]
    public void TakeLatestSignInCodeReturnsNewestAndPurgesOlderMatches()
    {
        var store = new CapturedEmailStore();
        var oldest = Message("player@example.com", "OLDEST01");
        var newest = Message("player@example.com", "NEWEST02");
        store.Add(oldest);
        store.Add(newest);

        var result = store.TakeLatestSignInCode("player@example.com");

        Assert.Equal(newest, result);
        Assert.Empty(store.Messages);
        Assert.Null(store.TakeLatestSignInCode("player@example.com"));
    }

    [Fact]
    public void TakeLatestSignInCodePreservesOtherRecipientsAndSubjects()
    {
        var store = new CapturedEmailStore();
        var matching = Message("player@example.com", "MATCH123");
        var otherRecipient = Message("other@example.com", "OTHER123");
        var otherSubject = new EmailMessage(
            "player@example.com",
            "Your Front Line account notice",
            "This is not a sign-in code.");
        store.Add(matching);
        store.Add(otherRecipient);
        store.Add(otherSubject);

        var result = store.TakeLatestSignInCode("player@example.com");

        Assert.Equal(matching, result);
        Assert.Equal([otherRecipient, otherSubject], store.Messages);
    }

    [Fact]
    public async Task TakeLatestSignInCodeAllowsAtMostOneConcurrentTakerToSucceed()
    {
        var store = new CapturedEmailStore();
        var expected = Message("player@example.com", "MATCH123");
        store.Add(expected);
        using var start = new ManualResetEventSlim();

        var takers = Enumerable.Range(0, 2)
            .Select(_ => Task.Run(() =>
            {
                start.Wait();
                return store.TakeLatestSignInCode("player@example.com");
            }))
            .ToArray();

        start.Set();
        var results = await Task.WhenAll(takers);

        Assert.Single(results, result => result is not null);
        Assert.Contains(expected, results);
        Assert.Empty(store.Messages);
    }

    private static EmailMessage Message(string recipient, string code)
    {
        return new EmailMessage(recipient, SignInCodeSubject, $"Your Front Line code is {code}.");
    }
}
