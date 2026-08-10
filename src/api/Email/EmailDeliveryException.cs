namespace frontLineApi.Email;

public enum EmailDeliveryFailureKind
{
    Timeout,
    AuthenticationOrConfiguration,
    ThrottledOrUnavailable,
    Rejected
}

public sealed class EmailDeliveryException(
    EmailDeliveryFailureKind failureKind)
    : Exception("The email provider did not accept the message.")
{
    public EmailDeliveryFailureKind FailureKind { get; } = failureKind;
}
