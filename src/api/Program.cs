
using System.Net;
using System.Text;
using frontLineApi.Auth;
using frontLineApi.Configuration;
using frontLineApi.Data;
using frontLineApi.Email;
using frontLineApi.E2E;
using frontLineApi.Health;
using frontLineApi.Middleware;
using frontLineApi.Results;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace frontLineApi;

public class Program
{
    private const string SigningKeyId = "frontline-auth";
    private const int MinimumSigningKeyLength = 32;
    private const int MinimumPepperLength = 32;

    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        ValidateProductionAuthenticationConfiguration(builder);
        ValidateProductionPasswordlessConfiguration(builder);

        if (builder.Environment.IsProduction())
        {
            builder.Logging.ClearProviders();
            builder.Logging.AddJsonConsole(options =>
            {
                options.IncludeScopes = true;
                options.TimestampFormat = "yyyy-MM-dd'T'HH:mm:ss.fff'Z'";
                options.UseUtcTimestamp = true;
            });
        }

        // Add services to the container.
        builder.Services.Configure<AuthenticationOptions>(builder.Configuration.GetSection("Authentication"));
        builder.Services.Configure<PasswordlessOptions>(builder.Configuration.GetSection("Passwordless"));
        builder.Services.Configure<HttpsRedirectionOptions>(
            builder.Configuration.GetSection(HttpsRedirectionOptions.SectionName));

        var emailOptions = builder.Services.AddOptions<EmailOptions>()
            .Bind(builder.Configuration.GetSection(EmailOptions.SectionName));
        var corsOptions = builder.Services.AddOptions<CorsOptions>()
            .Bind(builder.Configuration.GetSection(CorsOptions.SectionName));
        var publicUrlOptions = builder.Services.AddOptions<PublicUrlOptions>()
            .Configure(options => options.Value = builder.Configuration["PublicUrl"] ?? string.Empty);

        if (builder.Environment.IsProduction())
        {
            emailOptions
                .Validate(EmailOptions.IsValid, "Email settings must define authenticated SMTP with STARTTLS and bounded retry values.")
                .ValidateOnStart();
            corsOptions
                .Validate(CorsOptions.HasExplicitOrigins, "Cors:AllowedOrigins must contain only explicit HTTP(S) origins.")
                .ValidateOnStart();
            publicUrlOptions
                .Validate(PublicUrlOptions.IsValid, "PublicUrl must be an absolute HTTP(S) origin without credentials or a path.")
                .ValidateOnStart();
        }

        if (builder.Environment.IsEnvironment("E2E"))
        {
            builder.Services.AddOptions<E2eOptions>()
                .Bind(builder.Configuration.GetSection(E2eOptions.SectionName))
                .Validate(E2eOptions.HasValidAccessKey, $"E2E:AccessKey must be a non-placeholder value of at least {E2eOptions.MinimumAccessKeyLength} characters.")
                .ValidateOnStart();
        }

        builder.Services.AddDbContext<FrontLineDbContext>(options =>
        {
            if (builder.Environment.IsEnvironment("Testing") ||
                builder.Environment.IsEnvironment("E2E"))
            {
                var databaseName = builder.Environment.IsEnvironment("E2E")
                    ? builder.Configuration["E2E:InMemoryDatabaseName"] ?? $"FrontLineE2E-{Environment.ProcessId}"
                    : builder.Configuration["Testing:InMemoryDatabaseName"] ?? "FrontLineTests";
                options.UseInMemoryDatabase(
                    databaseName);
            }
            else
            {
                options.UseSqlServer(builder.Configuration.GetConnectionString("FrontLine"));
            }
        });

        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer();

        builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
            .Configure<Microsoft.Extensions.Options.IOptions<AuthenticationOptions>>((options, authenticationOptions) =>
            {
                var authentication = authenticationOptions.Value;
                var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(authentication.SigningKey))
                {
                    KeyId = SigningKeyId
                };

                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = authentication.Issuer,
                    ValidateAudience = true,
                    ValidAudience = authentication.Audience,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = signingKey,
                    TryAllIssuerSigningKeys = true,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromMinutes(1)
                };
            });

        builder.Services.AddAuthorization();

        builder.Services.AddCors(options =>
        {
            options.AddPolicy("FrontLineCors", policy =>
            {
                var allowedOrigins = builder.Configuration
                    .GetSection($"{CorsOptions.SectionName}:AllowedOrigins")
                    .Get<string[]>() ?? [];
                policy.WithOrigins(allowedOrigins)
                    .AllowAnyHeader()
                    .AllowAnyMethod();
            });
        });

        builder.Services.AddControllers();
        builder.Services.AddProblemDetails(options =>
        {
            options.CustomizeProblemDetails = context =>
            {
                context.ProblemDetails.Detail = null;
                context.ProblemDetails.Extensions["correlationId"] = context.HttpContext.TraceIdentifier;
            };
        });
        builder.Services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            options.ForwardLimit = 1;
            options.KnownIPNetworks.Clear();
            options.KnownProxies.Clear();
            options.KnownProxies.Add(IPAddress.Loopback);
            options.KnownProxies.Add(IPAddress.IPv6Loopback);
        });
        builder.Services.AddHealthChecks()
            .AddCheck<SqlServerHealthCheck>("sql-server", tags: ["ready"]);
        builder.Services.AddSingleton(TimeProvider.System);
        builder.Services.AddScoped<IPasswordlessAuthService, PasswordlessAuthService>();
        builder.Services.AddScoped<IMatchResultService, MatchResultService>();

        if (builder.Environment.IsProduction())
        {
            builder.Services.AddSingleton<ISmtpTransport, SystemNetSmtpTransport>();
            builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
        }
        else
        {
            builder.Services.AddSingleton<CapturedEmailStore>();
            builder.Services.AddScoped<IEmailSender, CapturingEmailSender>();
        }

        // Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
        builder.Services.AddOpenApi();

        var app = builder.Build();

        // Configure the HTTP request pipeline.
        app.UseForwardedHeaders();
        app.UseMiddleware<CorrelationIdMiddleware>();

        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi();
        }
        else
        {
            app.UseExceptionHandler();
        }

        if (app.Services.GetRequiredService<IOptions<HttpsRedirectionOptions>>().Value.Enabled)
        {
            app.UseHttpsRedirection();
        }

        app.UseCors("FrontLineCors");

        app.UseAuthentication();
        app.UseAuthorization();


        app.MapControllers();
        app.MapHealthChecks("/health/live", new HealthCheckOptions
        {
            Predicate = _ => false,
            ResponseWriter = HealthResponseWriter.WriteMinimalJsonAsync
        });
        app.MapHealthChecks("/health/ready", new HealthCheckOptions
        {
            Predicate = registration => registration.Tags.Contains("ready"),
            ResponseWriter = HealthResponseWriter.WriteMinimalJsonAsync
        });

        if (app.Environment.IsEnvironment("E2E"))
        {
            app.MapE2eAuthEndpoints();
        }

        app.Run();
    }

    private static void ValidateProductionAuthenticationConfiguration(WebApplicationBuilder builder)
    {
        if (!builder.Environment.IsProduction())
        {
            return;
        }

        var signingKey = builder.Configuration["Authentication:SigningKey"];
        if (string.IsNullOrWhiteSpace(signingKey) ||
            signingKey.Length < MinimumSigningKeyLength ||
            signingKey.Contains("development-placeholder", StringComparison.OrdinalIgnoreCase) ||
            signingKey.Contains("change-in-production", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "Authentication:SigningKey must be configured with a non-placeholder production secret.");
        }
    }

    private static void ValidateProductionPasswordlessConfiguration(WebApplicationBuilder builder)
    {
        if (!builder.Environment.IsProduction())
        {
            return;
        }

        var pepper = builder.Configuration["Passwordless:CodePepper"];
        if (string.IsNullOrWhiteSpace(pepper) ||
            pepper.Length < MinimumPepperLength ||
            pepper.Contains("development-placeholder", StringComparison.OrdinalIgnoreCase) ||
            pepper.Contains("change-in-production", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "Passwordless:CodePepper must be configured with a non-placeholder production secret.");
        }
    }
}
