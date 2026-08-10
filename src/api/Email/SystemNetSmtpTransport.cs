using System.Net;
using System.Net.Mail;
using frontLineApi.Configuration;

namespace frontLineApi.Email;

public sealed class SystemNetSmtpTransport : ISmtpTransport
{
    public async Task SendAsync(
        EmailMessage message,
        EmailOptions options,
        CancellationToken cancellationToken)
    {
        using var mailMessage = new MailMessage(options.From, message.To, message.Subject, message.Body);
        using var client = new SmtpClient(options.Host, options.Port)
        {
            Credentials = new NetworkCredential(options.Username, options.Password),
            DeliveryMethod = SmtpDeliveryMethod.Network,
            EnableSsl = options.UseStartTls,
            Timeout = checked(options.TimeoutSeconds * 1000),
            UseDefaultCredentials = false
        };

        await client.SendMailAsync(mailMessage, cancellationToken);
    }
}
