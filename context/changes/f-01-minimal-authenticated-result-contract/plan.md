# Minimal Authenticated Result Contract Implementation Plan

## Overview

Implement the foundation that lets Front Line authenticate a player with a passwordless email code and save a completed match result through a protected API contract. This change intentionally stops at a thin end-to-end foundation: minimal Angular auth UI, JWT session handling, SQL-backed identity/result persistence, and a save-only result endpoint.

## Current State Analysis

The repository is still mostly scaffolded. The API wires controllers and OpenAPI but only exposes the sample weather controller. The Angular app has the generated starter shell, empty routes, no HTTP provider, and no auth or API client layer. Persistence, passwordless email delivery, JWT authentication, migrations, and tests all need to be introduced by this change.

## Desired End State

A player can request a passwordless email code, verify the code, receive a JWT, keep that token through a browser-backed storage abstraction, and submit one completed match result to a protected endpoint. The API stores players, login codes, and match results in SQL Server, enforces structural validation, and treats repeated submissions with the same per-player `clientMatchId` as idempotent success. The change is verified by backend integration tests, client unit tests, and clean API/Angular builds.

### Key Discoveries:

- API is scaffold-level: controllers are registered in `src/api/Program.cs:12`, authorization middleware is called in `src/api/Program.cs:26`, and controllers are mapped in `src/api/Program.cs:29`, but no authentication services are configured.
- The only API package reference is OpenAPI in `src/api/frontLineApi.csproj:10`; there is no SQL Server provider, EF Core model, migration, or test project.
- The only implemented API route is the sample controller at `src/api/Controllers/WeatherForecastController.cs:5`.
- Angular routes are empty in `src/mbl/src/app/app.routes.ts:3`, and `src/mbl/src/app/app.config.ts:9` only provides routing, not HTTP or interceptors.
- Angular declares `npm test` in `src/mbl/package.json:9`, but `src/mbl/angular.json:42` has build/serve targets only; a real test target or equivalent script must be added before relying on client tests.
- F-01 is deliberately narrow: `context/foundation/roadmap.md:60` warns against overbuilding account or history features before the first match consumes them.

## What We're NOT Doing

- No full account profile, admin role, guest mode, or privileged role model.
- No match history list or latest-result read endpoint.
- No offline pending-result queue or resilient sync implementation; S-03 owns that.
- No backend-authoritative match simulation or replay validation.
- No production deployment, SQL backup automation, Gmail account setup, Capacitor setup, or Google Play work.
- No polished game UI; the client surface is only the auth flow and result client contract needed by later slices.

## Implementation Approach

Build the backend contract first, because the Angular client should consume stable endpoint shapes instead of inventing local behavior. Use ASP.NET Core JWT bearer auth, EF Core SQL Server persistence, and an application email sender abstraction with a production SMTP implementation plus deterministic dev/test behavior. Then add a thin Angular feature layer for passwordless login, token storage, authenticated HTTP calls, and a result-submit client. Keep route names, DTOs, and config names explicit so S-01 can build the match loop against them.

## Critical Implementation Details

### State sequencing

The API pipeline must call authentication before authorization. Passwordless verification should consume or invalidate a code before returning a JWT so a successful code cannot be replayed.

### Debug & observability

Do not log login codes, JWTs, Gmail app passwords, full email addresses, or submitted result payloads. Tests may inspect fake email deliveries through an in-memory adapter, not application logs.

## Phase 1: API Auth and Persistence Foundation

### Overview

Introduce the backend project structure, database model, JWT configuration, email abstraction, and API test project required by later phases.

### Changes Required:

#### 1. API project packages and configuration

**File**: `src/api/frontLineApi.csproj`

**Intent**: Add the framework packages needed for JWT bearer auth, EF Core SQL Server persistence, migrations, and production SMTP sending.

**Contract**: Package references must support ASP.NET Core `net10.0`, SQL Server, EF Core design-time migrations, JWT bearer authentication, and mail delivery through an application-owned adapter.

#### 2. Application settings

**File**: `src/api/appsettings.json`

**Intent**: Add non-secret configuration namespaces for connection strings, auth, passwordless codes, email, and CORS so production environment variables can override them.

**Contract**: Config keys include `ConnectionStrings:FrontLine`, `Authentication:Issuer`, `Authentication:Audience`, `Authentication:SigningKey`, `Authentication:TokenMinutes`, `Passwordless:CodeMinutes`, `Email:*`, and `Cors:AllowedOrigins`.

#### 3. Persistence model and DbContext

**File**: `src/api/Data/FrontLineDbContext.cs`

**Intent**: Create the first database boundary for players, passwordless login codes, and completed match results.

**Contract**: DbSets cover `Player`, `PasswordlessLoginCode`, and `MatchResult`; uniqueness is enforced for player email and per-player `clientMatchId`.

#### 4. Domain/storage entities

**File**: `src/api/Data/Entities/*.cs`

**Intent**: Define storage models with the minimum fields needed by auth and saved results.

**Contract**: `Player` has stable id/email/timestamps; `PasswordlessLoginCode` stores a hashed code, expiry, consumed timestamp, and player/email relation; `MatchResult` stores player id, client match id, outcome summary, duration, completion time, and creation time.

#### 5. Service registration

**File**: `src/api/Program.cs`

**Intent**: Register EF Core, JWT authentication, authorization, controllers, CORS, and application services in the existing API bootstrap.

**Contract**: `UseAuthentication()` appears before `UseAuthorization()`, and `MapControllers()` remains the controller endpoint boundary.

#### 6. API test project

**File**: `src/api.Tests/frontLineApi.Tests.csproj`

**Intent**: Add a separate API integration test project instead of placing tests inside `src/api`.

**Contract**: The test project references `src/api/frontLineApi.csproj`, supports WebApplicationFactory-style integration tests, and is included in the API solution.

### Success Criteria:

#### Automated Verification:

- API solution builds: `dotnet build src/api/frontLineApi.slnx`
- API test project is discoverable: `dotnet test src/api/frontLineApi.slnx --no-build`
- Initial EF Core migration exists and compiles with the API project

#### Manual Verification:

- Configuration names match the deployment plan's intended environment variable shape
- No secrets or real connection strings are committed

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Passwordless Auth Endpoints

### Overview

Add the backend request-code and verify-code flow, including generic responses, code hashing, fake/dev email behavior, SMTP adapter contract, and JWT issuance.

### Changes Required:

#### 1. Auth DTOs

**File**: `src/api/Contracts/Auth/*.cs`

**Intent**: Define request/response contracts for passwordless code request and code verification.

**Contract**: Request-code accepts an email address; verify-code accepts email plus code; verify response returns token, expiry, and minimal player identity.

#### 2. Auth controller

**File**: `src/api/Controllers/AuthController.cs`

**Intent**: Expose public endpoints for requesting and verifying passwordless login codes.

**Contract**: Routes are explicit, versionable API paths such as `POST /api/auth/request-code` and `POST /api/auth/verify-code`; request-code responses remain generic and do not reveal whether a player already exists.

#### 3. Passwordless auth service

**File**: `src/api/Auth/PasswordlessAuthService.cs`

**Intent**: Own code generation, hashing, expiry, single-use consumption, player creation/lookup, and JWT issuance.

**Contract**: Codes expire after configured minutes, successful verification consumes the code, and invalid/expired/consumed codes return a generic authentication failure.

#### 4. Email sender adapters

**File**: `src/api/Email/*.cs`

**Intent**: Add an `IEmailSender` abstraction with production SMTP behavior and deterministic dev/test behavior.

**Contract**: Production sends via configured SMTP; development/test can capture or write delivery without sending real email; neither path logs raw secrets or full login codes in production logs.

#### 5. Auth integration tests

**File**: `src/api.Tests/Auth/*.cs`

**Intent**: Verify the request/verify/token flow through HTTP against the test host.

**Contract**: Tests cover generic request-code response, successful verify returns JWT, invalid code fails, consumed code cannot be reused, and expired code fails.

### Success Criteria:

#### Automated Verification:

- Auth integration tests pass: `dotnet test src/api/frontLineApi.slnx --filter Auth`
- API builds cleanly: `dotnet build src/api/frontLineApi.slnx`

#### Manual Verification:

- A developer can request a code locally without configuring Gmail
- Auth endpoints never reveal whether an email already had an account

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Completed Result Write Contract

### Overview

Add the protected save-only completed-result endpoint with compact outcome summary payload, structural validation, SQL persistence, and idempotent duplicate handling.

### Changes Required:

#### 1. Result DTOs

**File**: `src/api/Contracts/Results/*.cs`

**Intent**: Define the minimal completed-result write contract that S-01 can call after a match ends.

**Contract**: Request includes `clientMatchId`, `outcome`, `durationSeconds`, `completedAt`, `finalScore`, and `finalFrontlinePosition`; response includes server result id, client match id, outcome, and saved timestamp.

#### 2. Results controller

**File**: `src/api/Controllers/ResultsController.cs`

**Intent**: Expose a protected save-only endpoint for completed match results.

**Contract**: `POST /api/results` requires an authenticated JWT and saves the result for the authenticated player only.

#### 3. Result service and validation

**File**: `src/api/Results/MatchResultService.cs`

**Intent**: Enforce structural validation and idempotent retry behavior before writing to SQL Server.

**Contract**: Validation requires sane duration and timestamp bounds, valid outcome enum values, bounded score/frontline values, and per-player uniqueness on `clientMatchId`; a repeated identical client match id returns the existing saved result.

#### 4. Result integration tests

**File**: `src/api.Tests/Results/*.cs`

**Intent**: Verify protected write behavior and idempotent retries through HTTP.

**Contract**: Tests cover unauthorized rejection, authenticated save success, invalid payload rejection, duplicate idempotent success, and duplicate conflict behavior if the same `clientMatchId` is reused with materially different payload.

### Success Criteria:

#### Automated Verification:

- Result integration tests pass: `dotnet test src/api/frontLineApi.slnx --filter Results`
- Full API tests pass: `dotnet test src/api/frontLineApi.slnx`
- API builds cleanly: `dotnet build src/api/frontLineApi.slnx`

#### Manual Verification:

- A locally issued JWT can save a result through the HTTP example or API client
- Re-sending the same completed result does not create a duplicate row

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Thin Angular Auth and Result Client

### Overview

Replace the starter shell with a minimal auth flow and add client-side contracts for token storage, authenticated requests, route protection, and result submission.

### Changes Required:

#### 1. Angular HTTP and app providers

**File**: `src/mbl/src/app/app.config.ts`

**Intent**: Wire Angular's HTTP client and authenticated request behavior into the application bootstrap.

**Contract**: Providers include `provideHttpClient()` and an interceptor or equivalent function that attaches the stored JWT to API requests.

#### 2. Auth routes and shell cleanup

**File**: `src/mbl/src/app/app.routes.ts`

**Intent**: Add routes for sign-in, code verification, and a protected placeholder route that later match screens can replace or extend.

**Contract**: Routes include public auth screens and a guarded protected route; starter placeholder content is removed from the root shell.

#### 3. Auth feature components

**File**: `src/mbl/src/app/auth/*`

**Intent**: Provide minimal screens for entering an email, entering the code, and handling verification state.

**Contract**: UI supports request-code and verify-code flows, shows generic failure messages, and stores the JWT through the storage abstraction on success.

#### 4. Token storage and auth state

**File**: `src/mbl/src/app/core/auth/*`

**Intent**: Add an auth state service and token storage abstraction backed by browser storage for F-01.

**Contract**: The abstraction can later be swapped for Capacitor Preferences without changing auth consumers; memory state initializes from storage on app startup.

#### 5. API clients

**File**: `src/mbl/src/app/core/api/*`

**Intent**: Add typed client methods for auth and save-only result submission.

**Contract**: Client methods mirror the API DTOs and expose observable/promise behavior consistent with Angular HTTP conventions.

#### 6. Angular test tooling and specs

**File**: `src/mbl/angular.json`

**Intent**: Add or repair the test target so `npm test` is real and client unit tests can run.

**Contract**: `npm test` runs the configured Angular/Vitest test path; specs cover auth service, token storage, guard behavior, and result client request shape.

### Success Criteria:

#### Automated Verification:

- Angular production build passes: `npm run build`
- Angular tests pass: `npm test`
- Client auth/result specs pass through the configured test target

#### Manual Verification:

- Browser flow can request a code, verify it using the dev/test delivery path, persist the JWT, and reach a protected placeholder route
- Authenticated result client can submit to the local API when supplied a completed-result summary

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Verification and Documentation Alignment

### Overview

Align local examples, configuration notes, and change metadata so the next slice can consume the auth/result foundation without rediscovering contracts.

### Changes Required:

#### 1. HTTP examples

**File**: `src/api/frontLineApi.http`

**Intent**: Replace or extend the weather sample with local request-code, verify-code, and save-result examples.

**Contract**: Examples use local host variables and a bearer token placeholder, without secrets or real login codes committed.

#### 2. README or context handoff notes

**File**: `README.md`

**Intent**: Document the local commands and required non-secret configuration for auth/result development.

**Contract**: Notes include API build/test, Angular build/test, local fake email behavior, and the config keys required for real SMTP/SQL Server.

#### 3. Change metadata

**File**: `context/changes/f-01-minimal-authenticated-result-contract/change.md`

**Intent**: Keep the change identity aligned with planned state.

**Contract**: Status is `planned`, dates are current, and notes continue to reference F-01 from the roadmap.

### Success Criteria:

#### Automated Verification:

- API build passes: `dotnet build src/api/frontLineApi.slnx`
- API tests pass: `dotnet test src/api/frontLineApi.slnx`
- Angular build passes from `src/mbl`: `npm run build`
- Angular tests pass from `src/mbl`: `npm test`

#### Manual Verification:

- README/local examples are sufficient for the next implementer to run auth and result-save smoke tests
- No references invite work on full history, offline sync, or production deployment inside F-01

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Angular token storage abstraction initializes, stores, reads, and clears tokens.
- Angular auth state transitions correctly after request-code, verify-code, and logout.
- Angular route guard allows authenticated access and redirects unauthenticated users.
- Angular result client sends the expected payload and authorization header path.

### Integration Tests:

- API passwordless request-code returns generic success.
- API verify-code returns a valid JWT for a captured test code.
- API rejects invalid, expired, and consumed codes.
- API rejects unauthenticated result writes.
- API accepts a structurally valid authenticated completed result.
- API returns idempotent success for repeated `clientMatchId`.
- API rejects invalid enum values, impossible durations, and out-of-bound timestamps/score values.

### Manual Testing Steps:

1. Start the API locally with development fake email behavior.
2. Start Angular locally.
3. Enter an email, request a code, retrieve the dev/test-delivered code, and verify it.
4. Confirm the JWT survives a browser refresh through the storage abstraction.
5. Submit a completed-result summary using the authenticated client path.
6. Retry the same `clientMatchId` and confirm no duplicate result is created.

## Performance Considerations

This change has low expected load. Add database indexes for player email, unexpired login code lookup, and per-player `clientMatchId` idempotency. Avoid expensive history queries because F-01 does not expose match history reads.

## Migration Notes

The first migration creates the auth and result tables. Since there is no production database yet, rollback is straightforward during development, but the migration should still be compatible with the deployment plan's later SQL Server Express setup and backup-before-migration rule.

## References

- Roadmap source: `context/foundation/roadmap.md`
- PRD auth requirement: `context/foundation/prd.md:66`
- PRD saved-result requirement: `context/foundation/prd.md:92`
- Stack source: `context/foundation/tech-stack.md`
- Deployment config assumptions: `context/changes/deployment/deployment-plan.md`
- Existing API bootstrap: `src/api/Program.cs:12`
- Existing Angular bootstrap: `src/mbl/src/app/app.config.ts:9`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` - <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: API Auth and Persistence Foundation

#### Automated

- [x] 1.1 API solution builds: `dotnet build src/api/frontLineApi.slnx` — ee47768
- [x] 1.2 API test project is discoverable: `dotnet test src/api/frontLineApi.slnx --no-build` — ee47768
- [x] 1.3 Initial EF Core migration exists and compiles with the API project — ee47768

#### Manual

- [x] 1.4 Configuration names match the deployment plan's intended environment variable shape — ee47768
- [x] 1.5 No secrets or real connection strings are committed — ee47768

### Phase 2: Passwordless Auth Endpoints

#### Automated

- [x] 2.1 Auth integration tests pass: `dotnet test src/api/frontLineApi.slnx --filter Auth` — f8bfd4f
- [x] 2.2 API builds cleanly: `dotnet build src/api/frontLineApi.slnx` — f8bfd4f

#### Manual

- [x] 2.3 A developer can request a code locally without configuring Gmail — f8bfd4f
- [x] 2.4 Auth endpoints never reveal whether an email already had an account — f8bfd4f

### Phase 3: Completed Result Write Contract

#### Automated

- [x] 3.1 Result integration tests pass: `dotnet test src/api/frontLineApi.slnx --filter Results` — 452c385
- [x] 3.2 Full API tests pass: `dotnet test src/api/frontLineApi.slnx` — 452c385
- [x] 3.3 API builds cleanly: `dotnet build src/api/frontLineApi.slnx` — 452c385

#### Manual

- [x] 3.4 A locally issued JWT can save a result through the HTTP example or API client — 452c385
- [x] 3.5 Re-sending the same completed result does not create a duplicate row — 452c385

### Phase 4: Thin Angular Auth and Result Client

#### Automated

- [x] 4.1 Angular production build passes: `npm run build`
- [x] 4.2 Angular tests pass: `npm test`
- [x] 4.3 Client auth/result specs pass through the configured test target

#### Manual

- [x] 4.4 Browser flow can request a code, verify it using the dev/test delivery path, persist the JWT, and reach a protected placeholder route
- [x] 4.5 Authenticated result client can submit to the local API when supplied a completed-result summary

### Phase 5: Verification and Documentation Alignment

#### Automated

- [ ] 5.1 API build passes: `dotnet build src/api/frontLineApi.slnx`
- [ ] 5.2 API tests pass: `dotnet test src/api/frontLineApi.slnx`
- [ ] 5.3 Angular build passes from `src/mbl`: `npm run build`
- [ ] 5.4 Angular tests pass from `src/mbl`: `npm test`

#### Manual

- [ ] 5.5 README/local examples are sufficient for the next implementer to run auth and result-save smoke tests
- [ ] 5.6 No references invite work on full history, offline sync, or production deployment inside F-01
