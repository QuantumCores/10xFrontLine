using System.Net.Mail;
using frontLineApi.Configuration;
using frontLineApi.Email;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace frontLineApi.Tests.Email;

public sealed class SmtpEmailSenderTests
{
    private static readonly EmailMessage Message = new(
        "player@example.com",
        "Your Front Line sign-in code",
        "Sensitive body");

    [Fact]
    public async Task RetriesTransientFailuresWithinConfiguredBound()
    {
        var transport = new StubTransport(
            new SmtpException(SmtpStatusCode.ServiceNotAvailable),
            new SmtpException(SmtpStatusCode.MailboxBusy));
        var sender = CreateSender(transport, maxRetryAttempts: 3);

        await sender.SendAsync(Message, CancellationToken.None);

        Assert.Equal(3, transport.AttemptCount);
    }

    [Fact]
    public async Task DoesNotRetryAuthenticationOrConfigurationFailure()
    {
        var transport = new StubTransport(new SmtpException(SmtpStatusCode.MustIssueStartTlsFirst));
        var sender = CreateSender(transport, maxRetryAttempts: 3);

        var exception = await Assert.ThrowsAsync<EmailDeliveryException>(
            () => sender.SendAsync(Message, CancellationToken.None));

        Assert.Equal(EmailDeliveryFailureKind.AuthenticationOrConfiguration, exception.FailureKind);
        Assert.Equal(1, transport.AttemptCount);
    }

    [Fact]
    public async Task RetriesTemporaryClientNotPermittedFailure()
    {
        var transport = new StubTransport(new SmtpException(SmtpStatusCode.ClientNotPermitted));
        var sender = CreateSender(transport, maxRetryAttempts: 3);

        await sender.SendAsync(Message, CancellationToken.None);

        Assert.Equal(2, transport.AttemptCount);
    }

    [Fact]
    public async Task DoesNotRetryPermanentTransactionFailure()
    {
        var transport = new StubTransport(new SmtpException(SmtpStatusCode.TransactionFailed));
        var sender = CreateSender(transport, maxRetryAttempts: 3);

        var exception = await Assert.ThrowsAsync<EmailDeliveryException>(
            () => sender.SendAsync(Message, CancellationToken.None));

        Assert.Equal(EmailDeliveryFailureKind.Rejected, exception.FailureKind);
        Assert.Equal(1, transport.AttemptCount);
    }

    [Fact]
    public async Task ReportsRejectionWithoutRetrying()
    {
        var transport = new StubTransport(new SmtpException(SmtpStatusCode.MailboxUnavailable));
        var sender = CreateSender(transport, maxRetryAttempts: 3);

        var exception = await Assert.ThrowsAsync<EmailDeliveryException>(
            () => sender.SendAsync(Message, CancellationToken.None));

        Assert.Equal(EmailDeliveryFailureKind.Rejected, exception.FailureKind);
        Assert.Equal(1, transport.AttemptCount);
    }

    [Fact]
    public async Task RetriesTimeoutOnlyToConfiguredBound()
    {
        var transport = new StubTransport(
            new TimeoutException(),
            new TimeoutException(),
            new TimeoutException());
        var sender = CreateSender(transport, maxRetryAttempts: 3);

        var exception = await Assert.ThrowsAsync<EmailDeliveryException>(
            () => sender.SendAsync(Message, CancellationToken.None));

        Assert.Equal(EmailDeliveryFailureKind.Timeout, exception.FailureKind);
        Assert.Equal(3, transport.AttemptCount);
    }

    [Fact]
    public void ProductionEmailOptionsRequireGmailStartTlsAndBoundedRetries()
    {
        Assert.True(EmailOptions.IsValid(CreateOptions(maxRetryAttempts: 3)));
        Assert.False(EmailOptions.IsValid(CreateOptions(maxRetryAttempts: 6)));
        var withoutStartTls = CreateOptions(maxRetryAttempts: 3);
        withoutStartTls.UseStartTls = false;
        Assert.False(EmailOptions.IsValid(withoutStartTls));
    }

    private static SmtpEmailSender CreateSender(StubTransport transport, int maxRetryAttempts)
    {
        return new SmtpEmailSender(
            Options.Create(CreateOptions(maxRetryAttempts)),
            transport,
            TimeProvider.System,
            NullLogger<SmtpEmailSender>.Instance);
    }

    private static EmailOptions CreateOptions(int maxRetryAttempts)
    {
        return new EmailOptions
        {
            Host = "smtp.gmail.com",
            Port = 587,
            UseStartTls = true,
            Username = "sender@example.com",
            Password = "app-password",
            From = "sender@example.com",
            TimeoutSeconds = 15,
            MaxRetryAttempts = maxRetryAttempts,
            RetryBaseDelayMilliseconds = 1
        };
    }

    private sealed class StubTransport(params Exception[] failures) : ISmtpTransport
    {
        private readonly Queue<Exception> _failures = new(failures);

        public int AttemptCount { get; private set; }

        public Task SendAsync(
            EmailMessage message,
            EmailOptions options,
            CancellationToken cancellationToken)
        {
            AttemptCount++;
            if (_failures.TryDequeue(out var exception))
            {
                return Task.FromException(exception);
            }

            return Task.CompletedTask;
        }
    }
}
