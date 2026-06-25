using System.ComponentModel.DataAnnotations;

namespace frontLineApi.Contracts.Results;

public sealed record CompletedResultRequest(
    [Required]
    [StringLength(80, MinimumLength = 1)]
    string ClientMatchId,
    [Required]
    string Outcome,
    [Range(1, 86_400)]
    int DurationSeconds,
    DateTimeOffset CompletedAt,
    [Range(-10_000, 10_000)]
    int FinalScore,
    [Range(0, 100)]
    int FinalFrontlinePosition);
