namespace frontLineApi.Data.Entities;

public sealed class MatchResult
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid PlayerId { get; set; }

    public Player? Player { get; set; }

    public string ClientMatchId { get; set; } = string.Empty;

    public string Outcome { get; set; } = string.Empty;

    public int DurationSeconds { get; set; }

    public DateTimeOffset CompletedAt { get; set; }

    public int FinalScore { get; set; }

    public int FinalFrontlinePosition { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
