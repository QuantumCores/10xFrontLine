namespace frontLineApi.Email;

public sealed class CapturedEmailStore
{
    private const string SignInCodeSubject = "Your Front Line sign-in code";
    private readonly List<EmailMessage> _messages = [];
    private readonly Lock _lock = new();

    public IReadOnlyList<EmailMessage> Messages
    {
        get
        {
            lock (_lock)
            {
                return _messages.ToArray();
            }
        }
    }

    public void Add(EmailMessage message)
    {
        lock (_lock)
        {
            _messages.Add(message);
        }
    }

    public EmailMessage? TakeLatestSignInCode(string recipient)
    {
        var normalizedRecipient = recipient.Trim();

        lock (_lock)
        {
            EmailMessage? latest = null;
            for (var index = _messages.Count - 1; index >= 0; index--)
            {
                var candidate = _messages[index];
                if (IsSignInCodeFor(candidate, normalizedRecipient))
                {
                    latest = candidate;
                    break;
                }
            }

            if (latest is null)
            {
                return null;
            }

            _messages.RemoveAll(message => IsSignInCodeFor(message, normalizedRecipient));
            return latest;
        }
    }

    private static bool IsSignInCodeFor(EmailMessage message, string normalizedRecipient)
    {
        return string.Equals(message.Subject, SignInCodeSubject, StringComparison.Ordinal) &&
            string.Equals(message.To.Trim(), normalizedRecipient, StringComparison.OrdinalIgnoreCase);
    }
}
