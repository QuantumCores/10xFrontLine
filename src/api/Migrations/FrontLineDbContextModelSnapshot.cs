using System;
using frontLineApi.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace frontLineApi.Migrations;

[DbContext(typeof(FrontLineDbContext))]
public partial class FrontLineDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
#pragma warning disable 612, 618
        modelBuilder
            .HasAnnotation("ProductVersion", "10.0.3")
            .HasAnnotation("Relational:MaxIdentifierLength", 128);

        modelBuilder.Entity("frontLineApi.Data.Entities.MatchResult", entity =>
        {
            entity.Property<Guid>("Id").HasColumnType("uniqueidentifier");
            entity.Property<Guid>("PlayerId").HasColumnType("uniqueidentifier");
            entity.Property<string>("ClientMatchId").IsRequired().HasMaxLength(80).HasColumnType("nvarchar(80)");
            entity.Property<DateTimeOffset>("CompletedAt").HasColumnType("datetimeoffset");
            entity.Property<DateTimeOffset>("CreatedAt").HasColumnType("datetimeoffset");
            entity.Property<int>("DurationSeconds").HasColumnType("int");
            entity.Property<int>("FinalFrontlinePosition").HasColumnType("int");
            entity.Property<int>("FinalScore").HasColumnType("int");
            entity.Property<string>("Outcome").IsRequired().HasMaxLength(24).HasColumnType("nvarchar(24)");

            entity.HasKey("Id");
            entity.HasIndex("PlayerId", "ClientMatchId").IsUnique();
            entity.ToTable("MatchResults");
        });

        modelBuilder.Entity("frontLineApi.Data.Entities.PasswordlessLoginCode", entity =>
        {
            entity.Property<Guid>("Id").HasColumnType("uniqueidentifier");
            entity.Property<string>("CodeHash").IsRequired().HasMaxLength(128).HasColumnType("nvarchar(128)");
            entity.Property<DateTimeOffset?>("ConsumedAt").HasColumnType("datetimeoffset");
            entity.Property<DateTimeOffset>("CreatedAt").HasColumnType("datetimeoffset");
            entity.Property<string>("Email").IsRequired().HasMaxLength(320).HasColumnType("nvarchar(320)");
            entity.Property<DateTimeOffset>("ExpiresAt").HasColumnType("datetimeoffset");
            entity.Property<Guid>("PlayerId").HasColumnType("uniqueidentifier");

            entity.HasKey("Id");
            entity.HasIndex("PlayerId", "ExpiresAt");
            entity.ToTable("PasswordlessLoginCodes");
        });

        modelBuilder.Entity("frontLineApi.Data.Entities.Player", entity =>
        {
            entity.Property<Guid>("Id").HasColumnType("uniqueidentifier");
            entity.Property<DateTimeOffset>("CreatedAt").HasColumnType("datetimeoffset");
            entity.Property<string>("Email").IsRequired().HasMaxLength(320).HasColumnType("nvarchar(320)");
            entity.Property<DateTimeOffset?>("UpdatedAt").HasColumnType("datetimeoffset");

            entity.HasKey("Id");
            entity.HasIndex("Email").IsUnique();
            entity.ToTable("Players");
        });

        modelBuilder.Entity("frontLineApi.Data.Entities.MatchResult", entity =>
        {
            entity.HasOne("frontLineApi.Data.Entities.Player", "Player")
                .WithMany("MatchResults")
                .HasForeignKey("PlayerId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();

            entity.Navigation("Player");
        });

        modelBuilder.Entity("frontLineApi.Data.Entities.PasswordlessLoginCode", entity =>
        {
            entity.HasOne("frontLineApi.Data.Entities.Player", "Player")
                .WithMany("LoginCodes")
                .HasForeignKey("PlayerId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();

            entity.Navigation("Player");
        });

        modelBuilder.Entity("frontLineApi.Data.Entities.Player", entity =>
        {
            entity.Navigation("LoginCodes");
            entity.Navigation("MatchResults");
        });
#pragma warning restore 612, 618
    }
}
