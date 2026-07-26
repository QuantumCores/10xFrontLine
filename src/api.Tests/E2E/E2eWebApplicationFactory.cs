using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace frontLineApi.Tests.E2E;

public sealed class E2eWebApplicationFactory(
    string? accessKey = E2eWebApplicationFactory.ValidAccessKey,
    IPAddress? remoteIpAddress = null) : WebApplicationFactory<Program>
{
    public const string ValidAccessKey = "test-e2e-access-key-with-at-least-thirty-two-random-bytes";
    private readonly string _databaseName = $"frontline-e2e-tests-{Guid.NewGuid():N}";
    private readonly IPAddress _remoteIpAddress = remoteIpAddress ?? IPAddress.Loopback;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("E2E");
        builder.ConfigureLogging(logging => logging.ClearProviders());
        builder.ConfigureAppConfiguration((_, configuration) =>
        {
            var settings = new Dictionary<string, string?>
            {
                ["Authentication:Issuer"] = "FrontLine.E2E.Tests",
                ["Authentication:Audience"] = "FrontLine.E2E.Tests.Client",
                ["Authentication:SigningKey"] = "test-signing-key-with-enough-entropy-for-hmac-sha256",
                ["Authentication:TokenMinutes"] = "30",
                ["Passwordless:CodeMinutes"] = "10",
                ["Passwordless:CodePepper"] = "test-code-pepper-with-enough-entropy-for-hmac-sha256",
                ["E2E:InMemoryDatabaseName"] = _databaseName
            };

            if (accessKey is not null)
            {
                settings["E2E:AccessKey"] = accessKey;
            }

            configuration.AddInMemoryCollection(settings);
        });
        builder.ConfigureServices(services =>
            services.AddSingleton<IStartupFilter>(new RemoteIpAddressStartupFilter(_remoteIpAddress)));
    }

    private sealed class RemoteIpAddressStartupFilter(IPAddress remoteIpAddress) : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next)
        {
            return app =>
            {
                app.Use(async (context, nextMiddleware) =>
                {
                    context.Connection.RemoteIpAddress = remoteIpAddress;
                    await nextMiddleware();
                });
                next(app);
            };
        }
    }
}
