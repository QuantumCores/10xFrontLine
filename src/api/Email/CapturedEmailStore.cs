namespace frontLineApi.Email;

public sealed class CapturedEmailStore
{
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
}
