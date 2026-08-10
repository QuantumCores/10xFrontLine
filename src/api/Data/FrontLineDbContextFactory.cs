using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace frontLineApi.Data;

public sealed class FrontLineDbContextFactory : IDesignTimeDbContextFactory<FrontLineDbContext>
{
    public FrontLineDbContext CreateDbContext(string[] args)
    {
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production";
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile($"appsettings.{environment}.json", optional: true)
            .AddEnvironmentVariables()
            .Build();
        var connectionString = configuration.GetConnectionString("FrontLine") ??
            throw new InvalidOperationException("ConnectionStrings:FrontLine must be configured.");

        var options = new DbContextOptionsBuilder<FrontLineDbContext>()
            .UseSqlServer(connectionString)
            .Options;

        return new FrontLineDbContext(options);
    }
}
