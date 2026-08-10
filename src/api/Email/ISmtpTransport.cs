using frontLineApi.Configuration;

namespace frontLineApi.Email;

public interface ISmtpTransport
{
    Task SendAsync(EmailMessage message, EmailOptions options, CancellationToken cancellationToken);
}
