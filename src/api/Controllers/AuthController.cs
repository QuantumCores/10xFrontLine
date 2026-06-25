using frontLineApi.Auth;
using frontLineApi.Contracts.Auth;
using Microsoft.AspNetCore.Mvc;

namespace frontLineApi.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(IPasswordlessAuthService authService) : ControllerBase
{
    private const string GenericRequestMessage = "If the email can access Front Line, a sign-in code will be sent.";
    private static readonly RequestCodeResponse GenericRequestResponse = new(GenericRequestMessage);

    [HttpPost("request-code")]
    public async Task<ActionResult<RequestCodeResponse>> RequestCode(
        RequestCodeRequest request,
        CancellationToken cancellationToken)
    {
        await authService.RequestCodeAsync(request, cancellationToken);

        return Ok(GenericRequestResponse);
    }

    [HttpPost("verify-code")]
    public async Task<ActionResult<VerifyCodeResponse>> VerifyCode(
        VerifyCodeRequest request,
        CancellationToken cancellationToken)
    {
        var response = await authService.VerifyCodeAsync(request, cancellationToken);

        return response is null
            ? Unauthorized(new { message = "Invalid or expired sign-in code." })
            : Ok(response);
    }
}
