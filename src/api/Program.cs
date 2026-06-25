
using System.Text;
using frontLineApi.Auth;
using frontLineApi.Configuration;
using frontLineApi.Data;
using frontLineApi.Email;
using frontLineApi.Results;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace frontLineApi;

public class Program
{
    private const string SigningKeyId = "frontline-auth";

    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        // Add services to the container.
        builder.Services.Configure<AuthenticationOptions>(builder.Configuration.GetSection("Authentication"));
        builder.Services.Configure<PasswordlessOptions>(builder.Configuration.GetSection("Passwordless"));
        builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection("Email"));

        builder.Services.AddDbContext<FrontLineDbContext>(options =>
        {
            if (builder.Environment.IsEnvironment("Testing"))
            {
                options.UseInMemoryDatabase(
                    builder.Configuration["Testing:InMemoryDatabaseName"] ?? "FrontLineTests");
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

        app.Run();
    }
}
