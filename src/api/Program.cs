
using System.Text;
using frontLineApi.Auth;
using frontLineApi.Configuration;
using frontLineApi.Data;
using frontLineApi.Email;
using frontLineApi.E2E;
using frontLineApi.Results;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace frontLineApi;

public class Program
{
    private const string SigningKeyId = "frontline-auth";
    private const int MinimumSigningKeyLength = 32;

    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        ValidateProductionAuthenticationConfiguration(builder);

        // Add services to the container.
        builder.Services.Configure<AuthenticationOptions>(builder.Configuration.GetSection("Authentication"));
        builder.Services.Configure<PasswordlessOptions>(builder.Configuration.GetSection("Passwordless"));
        builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection("Email"));

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

        var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        builder.Services.AddCors(options =>
        {
            options.AddPolicy("FrontLineCors", policy =>
            {
                policy.WithOrigins(allowedOrigins)
                    .AllowAnyHeader()
                    .AllowAnyMethod();
            });
        });

        builder.Services.AddControllers();
        builder.Services.AddSingleton(TimeProvider.System);
        builder.Services.AddScoped<IPasswordlessAuthService, PasswordlessAuthService>();
        builder.Services.AddScoped<IMatchResultService, MatchResultService>();

        if (builder.Environment.IsProduction())
        {
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
        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi();
        }

        app.UseHttpsRedirection();

        app.UseCors("FrontLineCors");

        app.UseAuthentication();
        app.UseAuthorization();


        app.MapControllers();

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
}
