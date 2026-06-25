using frontLineApi.Contracts.Auth;

namespace frontLineApi.Auth;

public interface IPasswordlessAuthService
{
    Task RequestCodeAsync(RequestCodeRequest request, CancellationToken cancellationToken);

    Task<VerifyCodeResponse?> VerifyCodeAsync(VerifyCodeRequest request, CancellationToken cancellationToken);
}
