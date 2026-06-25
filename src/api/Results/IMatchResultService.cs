using frontLineApi.Contracts.Results;

namespace frontLineApi.Results;

public interface IMatchResultService
{
    Task<MatchResultSaveResult> SaveCompletedResultAsync(
        Guid playerId,
        CompletedResultRequest request,
        CancellationToken cancellationToken);
}
