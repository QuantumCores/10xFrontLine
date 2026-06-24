using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace frontLineApi.Migrations;

public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Players",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                Email = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Players", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "MatchResults",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                PlayerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                ClientMatchId = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                Outcome = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                DurationSeconds = table.Column<int>(type: "int", nullable: false),
                CompletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                FinalScore = table.Column<int>(type: "int", nullable: false),
                FinalFrontlinePosition = table.Column<int>(type: "int", nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_MatchResults", x => x.Id);
                table.ForeignKey(
                    name: "FK_MatchResults_Players_PlayerId",
                    column: x => x.PlayerId,
                    principalTable: "Players",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "PasswordlessLoginCodes",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                PlayerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                Email = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                CodeHash = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                ExpiresAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                ConsumedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_PasswordlessLoginCodes", x => x.Id);
                table.ForeignKey(
                    name: "FK_PasswordlessLoginCodes_Players_PlayerId",
                    column: x => x.PlayerId,
                    principalTable: "Players",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_MatchResults_PlayerId_ClientMatchId",
            table: "MatchResults",
            columns: new[] { "PlayerId", "ClientMatchId" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_PasswordlessLoginCodes_PlayerId_ExpiresAt",
            table: "PasswordlessLoginCodes",
            columns: new[] { "PlayerId", "ExpiresAt" });

        migrationBuilder.CreateIndex(
            name: "IX_Players_Email",
            table: "Players",
            column: "Email",
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "MatchResults");
        migrationBuilder.DropTable(name: "PasswordlessLoginCodes");
        migrationBuilder.DropTable(name: "Players");
    }
}
