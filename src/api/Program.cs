
using System.Text;
using frontLineApi.Configuration;
using frontLineApi.Data;
using frontLineApi.Email;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace frontLineApi;

public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        // Add services to the container.
        builder.Services.Configure<AuthenticationOptions>(builder.Configuration.GetSection("Authentication"));
        builder.Services.Configure<PasswordlessOptions>(builder.Configuration.GetSection("Passwordless"));
        builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection("Email"));

        builder.Services.AddDbContext<FrontLineDbContext>(options =>
            options.UseSqlServer(builder.Configuration.GetConnectionString("FrontLine")));

        var authSection = builder.Configuration.GetSection("Authentication");
        var signingKey = authSection.GetValue<string>("SigningKey")
            ?? throw new InvalidOperationException("Authentication:SigningKey is required.");

        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = authSection.GetValue<string>("Issuer"),
                    ValidateAudience = true,
                    ValidAudience = authSection.GetValue<string>("Audience"),
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
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
        builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
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
