namespace frontLineApi.Data.Entities;

public sealed class Player
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Email { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? UpdatedAt { get; set; }

    public ICollection<PasswordlessLoginCode> LoginCodes { get; set; } = [];

    public ICollection<MatchResult> MatchResults { get; set; } = [];
}
