using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace frontLineApi.Migrations
{
    /// <inheritdoc />
    public partial class AddPasswordlessCodeSalt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CodeSalt",
                table: "PasswordlessLoginCodes",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CodeSalt",
                table: "PasswordlessLoginCodes");
        }
    }
}
