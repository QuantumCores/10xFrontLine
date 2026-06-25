using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using frontLineApi.Contracts.Results;
using frontLineApi.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace frontLineApi.Controllers;

[ApiController]
[Authorize]
[Route("api/results")]
public sealed class ResultsController(IMatchResultService matchResultService) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<CompletedResultResponse>> SaveCompletedResult(
        CompletedResultRequest request,
        CancellationToken cancellationToken)
    {
        var playerIdClaim = User.FindFirstValue("player_id")
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(playerIdClaim, out var playerId))
        {
            return Unauthorized();
        }

        var result = await matchResultService.SaveCompletedResultAsync(
            playerId,
            request,
            cancellationToken);

        return result.Status switch
        {
            MatchResultSaveStatus.Saved => Created($"/api/results/{result.Response!.ResultId}", result.Response),
            MatchResultSaveStatus.Idempotent => Ok(result.Response),
            MatchResultSaveStatus.Invalid => BadRequest(CreateValidationProblem(result.Errors!)),
            MatchResultSaveStatus.Conflict => Conflict(result.Errors),
            _ => throw new InvalidOperationException($"Unsupported result save status {result.Status}.")
        };
    }

    private static ValidationProblemDetails CreateValidationProblem(IReadOnlyDictionary<string, string[]> errors)
    {
        var details = new ValidationProblemDetails();
        foreach (var error in errors)
        {
            details.Errors.Add(error.Key, error.Value);
        }

        return details;
    }
}
