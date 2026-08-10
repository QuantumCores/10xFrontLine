using System.IO;
using System.Net.Mail;
using System.Net.Sockets;
using frontLineApi.Configuration;
using Microsoft.Extensions.Options;

namespace frontLineApi.Email;

public sealed class SmtpEmailSender(
    IOptions<EmailOptions> options,
    ISmtpTransport transport,
    TimeProvider timeProvider,
    ILogger<SmtpEmailSender> logger) : IEmailSender
{
    private readonly EmailOptions _options = options.Value;

    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        for (var attempt = 1; attempt <= _options.MaxRetryAttempts; attempt++)
        {
            try
            {
                await SendAttemptAsync(message, cancellationToken);
                return;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception) when (IsTransient(exception) && attempt < _options.MaxRetryAttempts)
            {
                logger.LogWarning(
                    "SMTP delivery encountered a transient failure; retrying attempt {NextAttempt} of {MaximumAttempts}",
                    attempt + 1,
                    _options.MaxRetryAttempts);

                var delay = TimeSpan.FromMilliseconds(
                    _options.RetryBaseDelayMilliseconds * Math.Pow(2, attempt - 1));
                await Task.Delay(delay, timeProvider, cancellationToken);
            }
            catch (Exception exception)
            {
                var failureKind = Classify(exception);
                logger.LogError(
                    "SMTP delivery failed with category {FailureKind} after {AttemptCount} attempt(s)",
                    failureKind,
                    attempt);
                throw new EmailDeliveryException(failureKind);
            }
        }
    }

    private async Task SendAttemptAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        using var timeoutSource = new CancellationTokenSource(
            TimeSpan.FromSeconds(_options.TimeoutSeconds),
            timeProvider);
        using var attemptSource = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeoutSource.Token);

        try
        {
            await transport.SendAsync(message, _options, attemptSource.Token);
        }
        catch (OperationCanceledException exception)
            when (timeoutSource.IsCancellationRequested && !cancellationToken.IsCancellationRequested)
        {
            throw new TimeoutException("The SMTP delivery attempt timed out.", exception);
        }
    }

    private static EmailDeliveryFailureKind Classify(Exception exception)
    {
        if (exception is TimeoutException || HasInnerException<TimeoutException>(exception))
        {
            return EmailDeliveryFailureKind.Timeout;
        }

        if (exception is not SmtpException smtpException)
        {
            return EmailDeliveryFailureKind.Rejected;
        }

        return smtpException.StatusCode switch
        {
            SmtpStatusCode.MailboxBusy or
            SmtpStatusCode.ServiceNotAvailable or
            SmtpStatusCode.InsufficientStorage or
            SmtpStatusCode.LocalErrorInProcessing or
            SmtpStatusCode.ClientNotPermitted => EmailDeliveryFailureKind.ThrottledOrUnavailable,
            SmtpStatusCode.MustIssueStartTlsFirst => EmailDeliveryFailureKind.AuthenticationOrConfiguration,
            SmtpStatusCode.GeneralFailure when
                HasInnerException<SocketException>(smtpException) ||
                HasInnerException<IOException>(smtpException) => EmailDeliveryFailureKind.ThrottledOrUnavailable,
            SmtpStatusCode.GeneralFailure => EmailDeliveryFailureKind.AuthenticationOrConfiguration,
            _ => EmailDeliveryFailureKind.Rejected
        };
    }

    private static bool IsTransient(Exception exception)
    {
        return Classify(exception) is EmailDeliveryFailureKind.Timeout or
            EmailDeliveryFailureKind.ThrottledOrUnavailable;
    }

    private static bool HasInnerException<TException>(Exception exception)
        where TException : Exception
    {
        for (var current = exception.InnerException; current is not null; current = current.InnerException)
        {
            if (current is TException)
            {
                return true;
            }
        }

        return false;
    }
}
