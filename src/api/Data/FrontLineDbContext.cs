using frontLineApi.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace frontLineApi.Data;

public sealed class FrontLineDbContext(DbContextOptions<FrontLineDbContext> options) : DbContext(options)
{
    public DbSet<Player> Players => Set<Player>();

    public DbSet<PasswordlessLoginCode> PasswordlessLoginCodes => Set<PasswordlessLoginCode>();

    public DbSet<MatchResult> MatchResults => Set<MatchResult>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Player>(entity =>
        {
            entity.HasKey(player => player.Id);
            entity.Property(player => player.Email).HasMaxLength(320).IsRequired();
            entity.Property(player => player.CreatedAt).IsRequired();
            entity.HasIndex(player => player.Email).IsUnique();
        });

        modelBuilder.Entity<PasswordlessLoginCode>(entity =>
        {
            entity.HasKey(code => code.Id);
            entity.Property(code => code.Email).HasMaxLength(320).IsRequired();
            entity.Property(code => code.CodeHash).HasMaxLength(128).IsRequired();
            entity.Property(code => code.CreatedAt).IsRequired();
            entity.Property(code => code.ExpiresAt).IsRequired();
            entity.HasOne(code => code.Player)
                .WithMany(player => player.LoginCodes)
                .HasForeignKey(code => code.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(code => new { code.PlayerId, code.ExpiresAt });
        });

        modelBuilder.Entity<MatchResult>(entity =>
        {
            entity.HasKey(result => result.Id);
            entity.Property(result => result.ClientMatchId).HasMaxLength(80).IsRequired();
            entity.Property(result => result.Outcome).HasMaxLength(24).IsRequired();
            entity.Property(result => result.DurationSeconds).IsRequired();
            entity.Property(result => result.CompletedAt).IsRequired();
            entity.Property(result => result.FinalScore).IsRequired();
            entity.Property(result => result.FinalFrontlinePosition).IsRequired();
            entity.Property(result => result.CreatedAt).IsRequired();
            entity.HasOne(result => result.Player)
                .WithMany(player => player.MatchResults)
                .HasForeignKey(result => result.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(result => new { result.PlayerId, result.ClientMatchId }).IsUnique();
        });
    }
}
