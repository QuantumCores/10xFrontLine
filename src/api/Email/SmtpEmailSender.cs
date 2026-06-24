using System.Net;
using System.Net.Mail;
using frontLineApi.Configuration;
using Microsoft.Extensions.Options;

namespace frontLineApi.Email;

public sealed class SmtpEmailSender(IOptions<EmailOptions> options) : IEmailSender
{
    private readonly EmailOptions _options = options.Value;

    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        using var mailMessage = new MailMessage(_options.From, message.To, message.Subject, message.Body);
        using var client = new SmtpClient(_options.Host, _options.Port)
        {
            EnableSsl = _options.UseStartTls
        };

        if (!string.IsNullOrWhiteSpace(_options.Username))
        {
            client.Credentials = new NetworkCredential(_options.Username, _options.Password);
        }

        await client.SendMailAsync(mailMessage, cancellationToken);
    }
}
