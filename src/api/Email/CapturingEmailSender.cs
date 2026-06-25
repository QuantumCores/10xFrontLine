namespace frontLineApi.Email;

public sealed class CapturingEmailSender(CapturedEmailStore store) : IEmailSender
{
    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        store.Add(message);
        return Task.CompletedTask;
    }
}
