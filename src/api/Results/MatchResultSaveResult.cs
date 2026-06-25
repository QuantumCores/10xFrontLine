using frontLineApi.Contracts.Results;

namespace frontLineApi.Results;

public enum MatchResultSaveStatus
{
    Saved,
    Idempotent,
    Invalid,
    Conflict
}

public sealed record MatchResultSaveResult(
    MatchResultSaveStatus Status,
    CompletedResultResponse? Response = null,
    IReadOnlyDictionary<string, string[]>? Errors = null)
{
    public static MatchResultSaveResult Saved(CompletedResultResponse response)
    {
        return new MatchResultSaveResult(MatchResultSaveStatus.Saved, response);
    }

    public static MatchResultSaveResult Idempotent(CompletedResultResponse response)
    {
        return new MatchResultSaveResult(MatchResultSaveStatus.Idempotent, response);
    }

    public static MatchResultSaveResult Invalid(IReadOnlyDictionary<string, string[]> errors)
    {
        return new MatchResultSaveResult(MatchResultSaveStatus.Invalid, Errors: errors);
    }

    public static MatchResultSaveResult Conflict()
    {
        return new MatchResultSaveResult(
            MatchResultSaveStatus.Conflict,
            Errors: new Dictionary<string, string[]>
            {
                ["clientMatchId"] = ["A different result already exists for this client match id."]
            });
    }
}
