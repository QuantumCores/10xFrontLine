namespace frontLineApi.Contracts.Results;

public sealed record CompletedResultResponse(
    Guid ResultId,
    string ClientMatchId,
    string Outcome,
    DateTimeOffset SavedAt);
