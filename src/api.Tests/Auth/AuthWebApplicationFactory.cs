using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace frontLineApi.Tests.Auth;

public sealed class AuthWebApplicationFactory(int codeMinutes = 10) : WebApplicationFactory<Program>
{
    private readonly string _databaseName = $"frontline-auth-tests-{Guid.NewGuid():N}";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureLogging(logging => logging.ClearProviders());
        builder.ConfigureAppConfiguration((_, configuration) =>
        {
            configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Authentication:Issuer"] = "FrontLine.Tests",
                ["Authentication:Audience"] = "FrontLine.Tests.Client",
                ["Authentication:SigningKey"] = "test-signing-key-with-enough-entropy-for-hmac-sha256",
                ["Authentication:TokenMinutes"] = "30",
                ["Passwordless:CodeMinutes"] = codeMinutes.ToString(),
                ["Passwordless:CodePepper"] = "test-code-pepper-with-enough-entropy-for-hmac-sha256",
                ["Testing:InMemoryDatabaseName"] = _databaseName
            });
        });
    }
}
