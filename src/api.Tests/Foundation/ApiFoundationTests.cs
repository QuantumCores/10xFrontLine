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
}
