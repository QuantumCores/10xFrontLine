using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace frontLineApi.Tests.Foundation;

public sealed class ApiFoundationTests
{
    [Fact]
    public void ApiProgramIsAvailableForIntegrationTests()
    {
        using var factory = new WebApplicationFactory<Program>();

        Assert.NotNull(factory.Server);
    }

    [Fact]
    public void ProductionStartupRejectsPlaceholderSigningKey()
    {
        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder => builder.UseEnvironment("Production"));

        var exception = Assert.Throws<InvalidOperationException>(() => factory.Server);

        Assert.Contains("Authentication:SigningKey", exception.Message);
    }
}
