# Playwright Valid OTP Test Seam Implementation Plan

## Overview

Add a test-only transport that lets a separately running Playwright CLI workflow retrieve the real passwordless login code already captured inside the API process. The transport will exist only in the exact `E2E` environment, run against a fresh in-memory database, require a per-run secret header, accept the target email in a `POST` body, and atomically remove the newest matching captured message when it returns the code.

The normal request-code and verify-code paths remain unchanged, including random generation, salted and peppered hashing, expiry, single-use verification, and JWT issuance. The Angular application remains unaware of the E2E endpoint.

## Current State Analysis

The API already has the correct delivery seam but exposes it only in-process. `PasswordlessAuthService.RequestCodeAsync` generates and persists a random code, then awaits `IEmailSender.SendAsync`; in non-production environments the registered `CapturingEmailSender` synchronously adds the plaintext email to singleton `CapturedEmailStore`. API integration tests resolve that store directly from `WebApplicationFactory`, but the standalone Playwright CLI cannot cross the process boundary.

The repository has no committed Playwright dependency, configuration, or browser test suite. The current workflow uses a globally installed `playwright-cli` and its generated accessibility snapshots. Those snapshots are useful locally for discovering active-session refs such as `e10`, but their timestamped files are generated session output rather than stable test source.

The frame established that real email delivery, a universal verifier code, file-based OTP transport, and changes to authentication behavior are outside the problem boundary.

## Desired End State

A developer can start the API on `127.0.0.1` in the exact `E2E` environment with an ephemeral access key, request a code through the normal Angular UI, retrieve the newest issued code for that email through `POST /api/e2e/auth/login-code`, and pass only that code to `playwright-cli fill`. Retrieval removes all matching captured login-code messages for that recipient so an older capture cannot surface on a later call.

The endpoint is not mapped outside `E2E`, does not return email bodies or other captured messages, rejects missing or incorrect access keys, does not serve non-loopback callers, and marks successful responses as non-cacheable. Existing Development OTP logging remains available exactly as it is today.

### Key Discoveries:

- Request-code awaits capture before returning HTTP 200, so the retrieval step can run immediately without polling (`src/api/Auth/PasswordlessAuthService.cs:34`, `src/api/Email/CapturingEmailSender.cs:5`).
- `CapturedEmailStore` is a singleton, lock-protected in-memory list, but currently supports only add and snapshot operations (`src/api/Email/CapturedEmailStore.cs:3`).
- Existing tests prove that a captured real code successfully traverses normal verification and JWT issuance (`src/api.Tests/Auth/AuthEndpointTests.cs:30`, `src/api.Tests/Auth/AuthEndpointTests.cs:127`).
- Exact environment selection already exists for the Testing in-memory database and `WebApplicationFactory` (`src/api/Program.cs:29`, `src/api.Tests/Auth/AuthWebApplicationFactory.cs:11`).
- Controllers are mapped unconditionally, so the E2E route should be conditionally mapped rather than added to `AuthController` (`src/api/Program.cs:115`, `src/api/Controllers/AuthController.cs:7`).
- The Angular client already completes the request/verify navigation and needs no E2E API knowledge (`src/mbl/src/app/core/api/auth-api.client.ts:38`, `src/mbl/src/app/auth/verify-code/verify-code.component.ts:40`).
- The installed CLI supports `--raw`, while PowerShell can safely send an environment-held header secret and pass only the response code to `playwright-cli fill`.

## What We're NOT Doing

- No universal, master, fixed, or development-only code in `VerifyCodeAsync`.
- No deterministic replacement for the random OTP generator.
- No OTP files, database plaintext, normal request-code response leakage, or E2E code logging.
- No real SMTP, inbox, Gmail, Mailpit, or other email-delivery verification.
- No Angular service, route, component, interceptor, environment, or bundle changes.
- No Playwright Test dependency, `playwright.config.*`, committed browser spec, browser orchestration helper, hook, or CI workflow.
- No E2E launch profile or PowerShell startup helper; the chosen workflow is documentation-only.
- No removal or modification of the existing Development OTP log.
- No EF Core entity change or migration.
- No write to `context/archive/`.

## Implementation Approach

First, make captured-message retrieval atomic and deterministic inside `CapturedEmailStore`. Then add a dedicated E2E endpoint group and configuration contract, registering the E2E in-memory database and mapping the route only when the host environment is exactly `E2E`. Cover the security and lifecycle behavior through API integration tests before documenting the two-terminal PowerShell and Playwright CLI workflow.

Use `E2E:AccessKey` as configuration supplied through the `E2E__AccessKey` environment variable and `X-FrontLine-E2E-Key` as the request header. The endpoint contract is `POST /api/e2e/auth/login-code` with `{ "email": "..." }`, returning only `{ "code": "..." }` on success. Missing or incorrect access keys return unauthorized without disclosing captured state; missing messages return not found; outside E2E the route itself is absent and therefore returns not found.

## Critical Implementation Details

### State sequencing

The request-code response already guarantees that email capture has completed. Retrieval must select the newest matching sign-in email and, under the same store lock, remove every matching sign-in-code message for that normalized recipient; otherwise a later retrieval could expose an older capture after the newest one is taken.

### Security boundary

The route must be conditionally mapped only for exact `E2E`, not guarded inside an always-mapped controller and not enabled by a generic non-production check. E2E startup must fail when the access key is missing or too weak, key comparison must avoid timing-sensitive ordinary equality, callers must be loopback, and successful responses must include `Cache-Control: no-store` without logging the key, code, email body, or response.

### Failure recovery

Take-and-remove makes retrieval intentionally one-shot. If the retrieval response is lost or parsing fails, the documented recovery is to request a new code through the UI rather than trying to recover the removed credential.

## Phase 1: Atomic Captured Login-Code Retrieval

### Overview

Add the concurrency-safe store operation that the endpoint will depend on, without changing delivery or normal authentication behavior.

### Changes Required:

#### 1. Captured message store

**File**: `src/api/Email/CapturedEmailStore.cs`

**Intent**: Allow a caller to atomically take the newest captured passwordless email for one normalized recipient while preventing older matching captures from resurfacing.

**Contract**: Add a lock-protected retrieval operation that matches recipient email case-insensitively after trimming, selects the newest matching Front Line sign-in-code message, returns that message, removes it and all older matching sign-in-code messages for the same recipient, and leaves unrelated recipients or unrelated message subjects untouched. Preserve the existing `Messages` snapshot contract for current integration tests.

#### 2. Store behavior tests

**File**: `src/api.Tests/Email/CapturedEmailStoreTests.cs`

**Intent**: Pin ordering, normalization, removal, isolation, and concurrency behavior independently of HTTP hosting.

**Contract**: Tests cover no match, trimmed/case-insensitive recipient matching, newest-message selection, purging older matching sign-in messages, preserving other recipients/messages, and two concurrent takers yielding the credential to at most one caller.

### Success Criteria:

#### Automated Verification:

- Captured store tests pass: `dotnet test src/api/frontLineApi.slnx --filter FullyQualifiedName~CapturedEmailStoreTests`
- API solution builds cleanly: `dotnet build src/api/frontLineApi.slnx`

**Implementation Note**: After completing this phase and all automated verification passes, proceed to the endpoint phase; no manual checkpoint is required because the new behavior is internal and fully covered by focused tests.

---

## Phase 2: Exact-E2E OTP Retrieval Endpoint

### Overview

Expose the atomic retrieval operation through a localhost-only, secret-protected route that is structurally absent from every environment except exact E2E.

### Changes Required:

#### 1. E2E configuration contract

**File**: `src/api/Configuration/E2eOptions.cs`

**Intent**: Give the endpoint one explicit, typed configuration namespace without placing any reusable secret in committed settings.

**Contract**: Define `E2E:AccessKey`; require a non-placeholder, high-entropy value in exact E2E and fail startup when it is missing, blank, or below the chosen minimum length. No access-key default is added to `appsettings*.json`, and the value must never be logged.

#### 2. E2E endpoint contracts and mapping

**File**: `src/api/E2E/E2eAuthEndpoints.cs`

**Intent**: Add a dedicated test transport without extending the production `AuthController` contract or exposing all captured mail.

**Contract**: Provide `POST /api/e2e/auth/login-code`, request body `{ email }`, response body `{ code }`, and header `X-FrontLine-E2E-Key`. Validate the email, compare the header key safely, reject non-loopback callers, atomically take the latest matching sign-in email, extract only its established eight-character alphanumeric code, and set `Cache-Control: no-store`. Return bad request for invalid input, unauthorized for a missing/incorrect key, and not found when no retrievable message exists; do not include sensitive details in failures.

#### 3. Environment-specific application wiring

**File**: `src/api/Program.cs`

**Intent**: Make E2E a self-contained host mode while guaranteeing the retrieval route does not exist elsewhere.

**Contract**: Treat exact `E2E` like exact `Testing` for EF Core InMemory registration, using an E2E-specific process-local database name. Register and validate E2E options only as needed, and call the E2E endpoint mapping only inside `app.Environment.IsEnvironment("E2E")`. Preserve current Production SMTP, non-production capture, Development code logging, middleware order, controller mapping, and production authentication validation.

#### 4. Dedicated E2E test host

**File**: `src/api.Tests/E2E/E2eWebApplicationFactory.cs`

**Intent**: Exercise exact-E2E startup and endpoint behavior without changing the existing Testing factory or depending on local SQL Server.

**Contract**: Start `Program` with environment `E2E`, a unique in-memory database, test authentication secrets, and a configurable E2E access key. Support negative startup tests where the access key is absent or invalid.

#### 5. Endpoint integration tests

**File**: `src/api.Tests/E2E/E2eLoginCodeEndpointTests.cs`

**Intent**: Prove the endpoint exposes only the intended credential under the intended host conditions and that the returned code remains a real valid OTP.

**Contract**: Cover request-code → protected retrieval → normal verify → JWT success; missing/wrong key rejection; invalid email; absent/mismatched recipient; normalized email; newest issuance selection with older captures purged; one-shot retrieval; isolation between recipients; non-cacheable success; loopback enforcement; startup failure without a valid E2E key; and route absence under Testing and Development. Confirm the normal request-code response remains generic.

### Success Criteria:

#### Automated Verification:

- E2E endpoint integration tests pass: `dotnet test src/api/frontLineApi.slnx --filter FullyQualifiedName~E2eLoginCodeEndpointTests`
- Existing auth integration tests pass unchanged: `dotnet test src/api/frontLineApi.slnx --filter FullyQualifiedName~AuthEndpointTests`
- API solution builds cleanly: `dotnet build src/api/frontLineApi.slnx`

#### Manual Verification:

- Code review confirms the E2E route mapping is nested under an exact `IsEnvironment("E2E")` condition and no reusable access key is committed

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation of the exact-environment and secret-boundary review before documenting the operator workflow.

---

## Phase 3: Manual Playwright Workflow and Generated-Artifact Hygiene

### Overview

Document a reproducible two-terminal workflow that keeps the access key out of source and passes only the retrieved OTP into the current Playwright CLI session.

### Changes Required:

#### 1. E2E startup and login instructions

**File**: `README.md`

**Intent**: Replace ad-hoc code discovery with an explicit manual workflow that can be followed without a committed helper or Playwright test harness.

**Contract**: Add an E2E passwordless-login section that documents generating at least 32 random bytes for a per-run key, supplying it as `E2E__AccessKey`, setting `ASPNETCORE_ENVIRONMENT=E2E`, binding `ASPNETCORE_URLS` to `http://127.0.0.1:5178`, and starting with `dotnet run --no-launch-profile` so Development launch settings cannot override the environment. Document a second PowerShell terminal that holds the same key in an environment variable, uses `Invoke-RestMethod` to send the protected `POST` without embedding the key literal in shell history, stores only the returned code in `$code`, and calls `playwright-cli fill <current-code-ref> $code`. Include cleanup of the environment variable/clipboard and recovery by requesting a new code after a failed one-shot retrieval.

The instructions must tell the operator to refresh the Playwright snapshot and use the current refs rather than assuming `e10`, `e11`, `e22`, or `e23` remain stable across runs. State explicitly that normal Development OTP logging remains supported and unchanged.

#### 2. Generated CLI output policy

**File**: `.gitignore`

**Intent**: Keep timestamped Playwright CLI snapshots, console logs, traces, screenshots, and other local session output out of commits without interfering with local ref discovery.

**Contract**: Ignore `/.playwright-cli/`. Document in the README that ignoring the directory does not stop snapshot generation or active-session ref usage; any evidence intentionally retained must be saved under an explicit stable filename outside the generated directory, reviewed for OTPs/emails/tokens, and placed in the active change folder rather than `context/archive/`.

### Success Criteria:

#### Automated Verification:

- Full API test suite passes: `dotnet test src/api/frontLineApi.slnx`
- API solution builds cleanly: `dotnet build src/api/frontLineApi.slnx`
- Generated CLI output is ignored: `git check-ignore .playwright-cli/page-generated.yml`

#### Manual Verification:

- A human starts the API in exact E2E on `127.0.0.1`, follows the documented request/retrieve/fill/verify sequence, and reaches the authenticated `/play` route
- A second retrieval for the same issued code returns not found, and requesting a new code restores the workflow
- Starting the API normally in Development leaves the E2E route unavailable while preserving the existing Development OTP console log
- Local `.playwright-cli/` snapshots continue to appear and provide current element refs without showing as untracked Git files

**Implementation Note**: Browser interaction is a human manual checkpoint under the current lesson boundary; the implementing agent must not add or execute Playwright browser specs in this phase.

---

## Testing Strategy

### Unit Tests:

- Exercise `CapturedEmailStore` matching and mutation without HTTP or database dependencies.
- Prove newest-first selection, normalized recipient matching, removal of stale matching captures, preservation of unrelated messages, and at-most-one successful concurrent take.

### Integration Tests:

- Exercise the complete normal issuance → E2E retrieval → normal verification path through `WebApplicationFactory`.
- Verify environment isolation, access-key validation, loopback restriction, response cache headers, one-shot behavior, recipient isolation, and generic public auth responses.
- Re-run existing invalid, expired, consumed, and case-insensitive auth coverage unchanged.

### Manual Testing Steps:

1. Generate one ephemeral key without placing it in source or command history.
2. Start the API with exact E2E, an in-memory database, and loopback binding using `--no-launch-profile`.
3. Start Angular normally and open it with `playwright-cli`.
4. Take a current snapshot, fill the email ref, and click the current request-code ref.
5. Retrieve the code with PowerShell using the secret header and store only the response code in a shell variable.
6. Take the current verification-page snapshot, fill its current code ref, and click the current verify ref.
7. Confirm navigation to `/play`, then confirm the same capture cannot be retrieved twice.
8. Stop the E2E API and clear the per-run key from environment variables and clipboard.

## Performance Considerations

The capture store is test-process memory and expected volume is tiny. Atomic selection/removal must perform one locked scan from newest to oldest and purge matching stale entries without exposing the mutable list; no cache, persistence, background cleanup, or database index is warranted for this E2E-only path.

## Migration Notes

There is no schema or data migration. The E2E database is process-local and discarded when the API stops. Rolling back the change means removing the conditional endpoint/configuration wiring and store operation; production data and contracts are unaffected.

## References

- Frame brief: `context/changes/playwright-valid-otp-test-seam/frame.md`
- Repository lessons: `context/foundation/lessons.md`
- Existing code capture: `src/api/Auth/PasswordlessAuthService.cs:50`
- Existing capture store: `src/api/Email/CapturedEmailStore.cs:3`
- Existing positive auth integration test: `src/api.Tests/Auth/AuthEndpointTests.cs:30`
- Existing in-process code retrieval: `src/api.Tests/Auth/AuthEndpointTests.cs:127`
- Exact Testing environment pattern: `src/api.Tests/Auth/AuthWebApplicationFactory.cs:11`
- Conditional application bootstrap: `src/api/Program.cs:29`
- Prior raw-code security review: `context/changes/f-01-minimal-authenticated-result-contract/reviews/impl-review.md:23`
- Current browser auth calls: `src/mbl/src/app/core/api/auth-api.client.ts:38`
- Current CLI-generated snapshots: `.playwright-cli/page-*.yml`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Atomic Captured Login-Code Retrieval

#### Automated

- [x] 1.1 Captured store tests pass: `dotnet test src/api/frontLineApi.slnx --filter FullyQualifiedName~CapturedEmailStoreTests`
- [x] 1.2 API solution builds cleanly: `dotnet build src/api/frontLineApi.slnx`

### Phase 2: Exact-E2E OTP Retrieval Endpoint

#### Automated

- [ ] 2.1 E2E endpoint integration tests pass: `dotnet test src/api/frontLineApi.slnx --filter FullyQualifiedName~E2eLoginCodeEndpointTests`
- [ ] 2.2 Existing auth integration tests pass unchanged: `dotnet test src/api/frontLineApi.slnx --filter FullyQualifiedName~AuthEndpointTests`
- [ ] 2.3 API solution builds cleanly: `dotnet build src/api/frontLineApi.slnx`

#### Manual

- [ ] 2.4 Code review confirms the E2E route mapping is nested under an exact `IsEnvironment("E2E")` condition and no reusable access key is committed

### Phase 3: Manual Playwright Workflow and Generated-Artifact Hygiene

#### Automated

- [ ] 3.1 Full API test suite passes: `dotnet test src/api/frontLineApi.slnx`
- [ ] 3.2 API solution builds cleanly: `dotnet build src/api/frontLineApi.slnx`
- [ ] 3.3 Generated CLI output is ignored: `git check-ignore .playwright-cli/page-generated.yml`

#### Manual

- [ ] 3.4 A human starts the API in exact E2E on `127.0.0.1`, follows the documented request/retrieve/fill/verify sequence, and reaches the authenticated `/play` route
- [ ] 3.5 A second retrieval for the same issued code returns not found, and requesting a new code restores the workflow
- [ ] 3.6 Starting the API normally in Development leaves the E2E route unavailable while preserving the existing Development OTP console log
- [ ] 3.7 Local `.playwright-cli/` snapshots continue to appear and provide current element refs without showing as untracked Git files
