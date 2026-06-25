using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace frontLineApi.Data;

public sealed class FrontLineDbContextFactory : IDesignTimeDbContextFactory<FrontLineDbContext>
{
    public FrontLineDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<FrontLineDbContext>()
            .UseSqlServer("Server=.;Database=FrontLine;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true")
            .Options;

        return new FrontLineDbContext(options);
    }
}