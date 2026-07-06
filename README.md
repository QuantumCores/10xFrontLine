# Front Line

Front Line is a small MVP codebase with an Angular mobile/browser client in `src/mbl` and an ASP.NET Core API in `src/api`. The current foundation slice, F-01, adds passwordless email-code authentication and a protected completed-result write contract for the first saved match flow.

## Local Commands

Run API commands from the repository root:

```powershell
dotnet build src/api/frontLineApi.slnx
dotnet test src/api/frontLineApi.slnx
dotnet run --project src/api/frontLineApi.csproj
```

Run Angular commands from `src/mbl`:

```powershell
npm install
npm run build
npm test
npm start
```

The API development profile listens on `http://localhost:5178`. The Angular client uses `http://localhost:5178/api` as its default API base URL and serves locally through Angular CLI, normally `http://localhost:4200`.

## Android Local Verification

Run these commands from `src/mbl` after installing dependencies:

```powershell
npm run build
npx cap sync android
npx cap open android
```

To run directly on a connected Android device or emulator, use:

```powershell
npx cap run android
```

This path is for local S-01 Android verification only. Production signing, Play Console setup, and release `.aab` generation are intentionally out of scope.

## Auth and Result Smoke Tests

Use `src/api/frontLineApi.http` for local HTTP smoke checks:

1. Run the API with `dotnet run --project src/api/frontLineApi.csproj`.
2. Send `POST /api/auth/request-code` with an email address.
3. Send `POST /api/auth/verify-code` with the same email and the delivered code.
4. Paste the returned JWT into the `@token` variable.
5. Send `POST /api/results` with a current `completedAt` timestamp.
6. Re-send the same result body and confirm it returns success without creating a duplicate.

In non-production API environments, email delivery uses the in-memory `CapturedEmailStore` adapter so automated tests can inspect the generated message without sending real mail. Production uses the SMTP adapter and must be configured with real email settings through environment variables or another secret source. Do not commit real login codes, JWTs, SMTP passwords, or connection strings.

## Configuration

Non-secret development defaults live in `src/api/appsettings.json`. Production or machine-specific values should override these keys outside source control:

- `ConnectionStrings:FrontLine`
- `Authentication:Issuer`
- `Authentication:Audience`
- `Authentication:SigningKey`
- `Authentication:TokenMinutes`
- `Passwordless:CodeMinutes`
- `Passwordless:CodePepper`
- `Email:Host`
- `Email:Port`
- `Email:UseStartTls`
- `Email:Username`
- `Email:Password`
- `Email:From`
- `Cors:AllowedOrigins`

For environment variables, use ASP.NET Core double-underscore names such as `ConnectionStrings__FrontLine`, `Authentication__SigningKey`, `Passwordless__CodePepper`, and `Email__Password`.

## Scope Boundary

F-01 only provides sign-in, token persistence, and save-only completed-result submission. Full match history, offline result queues, production deployment automation, production Android release work, and broader gameplay are owned by later roadmap slices.
