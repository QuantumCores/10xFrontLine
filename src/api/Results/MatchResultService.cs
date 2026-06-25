using frontLineApi.Contracts.Results;
using frontLineApi.Data;
using frontLineApi.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace frontLineApi.Results;

public sealed class MatchResultService(
    FrontLineDbContext dbContext,
    TimeProvider timeProvider) : IMatchResultService
{
    private static readonly HashSet<string> ValidOutcomes = new(StringComparer.OrdinalIgnoreCase)
    {
        "Victory",
        "Defeat"
    };

    public async Task<MatchResultSaveResult> SaveCompletedResultAsync(
        Guid playerId,
        CompletedResultRequest request,
        CancellationToken cancellationToken)
    {
        var validationErrors = Validate(request);
        if (validationErrors.Count > 0)
        {
            return MatchResultSaveResult.Invalid(validationErrors);
        }

        var normalizedClientMatchId = NormalizeClientMatchId(request.ClientMatchId);
        var normalizedOutcome = NormalizeOutcome(request.Outcome);
        var existingResult = await dbContext.MatchResults
            .SingleOrDefaultAsync(
                result => result.PlayerId == playerId && result.ClientMatchId == normalizedClientMatchId,
                cancellationToken);

        if (existingResult is not null)
        {
            return Matches(existingResult, request, normalizedOutcome)
                ? MatchResultSaveResult.Idempotent(ToResponse(existingResult))
                : MatchResultSaveResult.Conflict();
        }

        var now = timeProvider.GetUtcNow();
        var result = new MatchResult
        {
            PlayerId = playerId,
            ClientMatchId = normalizedClientMatchId,
            Outcome = normalizedOutcome,
            DurationSeconds = request.DurationSeconds,
            CompletedAt = request.CompletedAt.ToUniversalTime(),
            FinalScore = request.FinalScore,
            FinalFrontlinePosition = request.FinalFrontlinePosition,
            CreatedAt = now
        };

        dbContext.MatchResults.Add(result);
        await dbContext.SaveChangesAsync(cancellationToken);

        return MatchResultSaveResult.Saved(ToResponse(result));
    }

    private Dictionary<string, string[]> Validate(CompletedResultRequest request)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);

        if (string.IsNullOrWhiteSpace(request.ClientMatchId))
        {
            errors["clientMatchId"] = ["Client match id is required."];
        }

        if (!ValidOutcomes.Contains(request.Outcome.Trim()))
        {
            errors["outcome"] = ["Outcome must be Victory or Defeat."];
        }

        if (request.DurationSeconds is < 1 or > 86_400)
        {
            errors["durationSeconds"] = ["Duration must be between 1 second and 24 hours."];
        }

        var now = timeProvider.GetUtcNow();
        if (request.CompletedAt > now.AddMinutes(5))
        {
            errors["completedAt"] = ["Completed time cannot be more than 5 minutes in the future."];
        }
        else if (request.CompletedAt < now.AddDays(-30))
        {
            errors["completedAt"] = ["Completed time cannot be older than 30 days."];
        }

        if (request.FinalScore is < -10_000 or > 10_000)
        {
            errors["finalScore"] = ["Final score is outside the accepted bounds."];
        }

        if (request.FinalFrontlinePosition is < 0 or > 100)
        {
            errors["finalFrontlinePosition"] = ["Final frontline position must be between 0 and 100."];
        }

        return errors;
    }

    private static bool Matches(
        MatchResult existingResult,
        CompletedResultRequest request,
        string normalizedOutcome)
    {
        return existingResult.Outcome == normalizedOutcome &&
            existingResult.DurationSeconds == request.DurationSeconds &&
            existingResult.CompletedAt == request.CompletedAt.ToUniversalTime() &&
            existingResult.FinalScore == request.FinalScore &&
            existingResult.FinalFrontlinePosition == request.FinalFrontlinePosition;
    }

    private static CompletedResultResponse ToResponse(MatchResult result)
    {
        return new CompletedResultResponse(
            result.Id,
            result.ClientMatchId,
            result.Outcome,
            result.CreatedAt);
    }

    private static string NormalizeClientMatchId(string clientMatchId)
    {
        return clientMatchId.Trim();
    }

    private static string NormalizeOutcome(string outcome)
    {
        var trimmedOutcome = outcome.Trim();
        return ValidOutcomes.Single(validOutcome =>
            string.Equals(validOutcome, trimmedOutcome, StringComparison.OrdinalIgnoreCase));
    }
}
