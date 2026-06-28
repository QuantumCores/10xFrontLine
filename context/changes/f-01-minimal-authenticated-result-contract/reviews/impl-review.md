<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Minimal Authenticated Result Contract

- **Plan**: context/changes/f-01-minimal-authenticated-result-contract/plan.md
- **Scope**: Phases 1-5 of 5
- **Date**: 2026-06-28
- **Verdict**: REJECTED
- **Findings**: 1 critical 4 warnings 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | FAIL |
| Scope Discipline | WARNING |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 - Raw login codes and full emails are logged

- **Severity**: CRITICAL
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality / Plan Adherence
- **Location**: src/api/Auth/PasswordlessAuthService.cs:49
- **Detail**: `logger.LogWarning($"{email} : {code}")` logs the normalized full email and raw passwordless code. The plan explicitly says not to log login codes or full email addresses. Anyone with log access can sign in before expiry.
- **Fix**: Remove the raw code/email log and use a non-log dev/test delivery path for local retrieval.
- **Decision**: FIXED - kept the manual-testing code log, but guarded it with `IHostEnvironment.IsDevelopment()` so production and testing environments do not emit raw codes or full emails.

### F2 - Passwordless code hashes are cheap to brute-force offline

- **Severity**: WARNING
- **Impact**: MEDIUM - real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/api/Auth/PasswordlessAuthService.cs:129
- **Detail**: Six-digit codes are stored as fast, unkeyed SHA-256 hashes of `email:code`. If the DB leaks, active codes are cheap to recover offline.
- **Fix**: Use a keyed HMAC/pepper stored outside the DB, or a slow verifier.
  - Strength: Keeps DB-only compromise from immediately revealing codes.
  - Tradeoff: Adds secret/config handling and migration consideration.
  - Confidence: HIGH - the current code space is only 1,000,000 values.
  - Blind spot: No production secret-management mechanism is implemented yet.
- **Decision**: FIXED - implemented salt plus pepper and expanded codes from six numeric digits to eight case-insensitive alphanumeric characters. Each login code stores a random SQL-backed `CodeSalt`, and the normalized code hash is now HMAC-SHA256 with `Passwordless:CodePepper`, which must be supplied from configuration outside the database in production.

### F3 - Production can silently use the committed JWT signing key

- **Severity**: WARNING
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/api/appsettings.json:8
- **Detail**: The placeholder signing key is functional. If production misses its environment override, source access is enough to forge JWTs.
- **Fix**: Fail startup in Production when the signing key is empty, placeholder-like, or below the required length/entropy.
- **Decision**: FIXED - added a production-only startup guard that rejects empty, too-short, or placeholder-like `Authentication:SigningKey` values, plus a foundation test covering the placeholder production failure.

### F4 - Auth endpoints have no throttling

- **Severity**: WARNING
- **Impact**: MEDIUM - real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/api/Controllers/AuthController.cs:14
- **Detail**: `request-code` and `verify-code` are public and unthrottled, leaving the email sender open to abuse and allowing online guessing attempts.
- **Fix**: Add ASP.NET Core rate limiting by IP and normalized email while preserving generic auth responses.
  - Strength: Directly protects the exposed boundary.
  - Tradeoff: Needs careful tests to avoid account-enumeration signals.
  - Confidence: HIGH - both endpoints are unauthenticated public routes.
  - Blind spot: Deployment proxy/rate-limit behavior is not known.
- **Decision**: SKIPPED - accepted for now; throttling is deferred rather than changed in this review triage.

### F5 - Concurrent duplicate result submissions can race into 500s

- **Severity**: WARNING
- **Impact**: MEDIUM - real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/api/Results/MatchResultService.cs:32
- **Detail**: Idempotency checks read before insert, then rely on a unique index. Concurrent identical submissions can hit `DbUpdateException` instead of returning idempotent success.
- **Fix**: Catch unique-constraint `DbUpdateException`, reload the row, compare payload, then return idempotent success or conflict.
  - Strength: Preserves the public idempotency contract under concurrency.
  - Tradeoff: Provider-specific error detection needs care.
  - Confidence: MEDIUM - race is real, but exact SQL Server exception shape was not exercised.
  - Blind spot: No concurrent integration test exists.
- **Decision**: SKIPPED - accepted for now; concurrent duplicate handling is deferred rather than changed in this review triage.

### F6 - Local helper prints the full JWT

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .scripts/getAuthToken.ps1:31
- **Detail**: The helper prints the full token to the terminal. It is local-only, but it conflicts with the "do not log JWTs" posture.
- **Fix**: Copy to clipboard without printing the full JWT, or print only a short prefix/suffix.
- **Decision**: FIXED - updated `.scripts/getAuthToken.ps1` to copy the full JWT to clipboard when possible and print only a short masked token preview.

### F7 - Change metadata date is stale

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/f-01-minimal-authenticated-result-contract/change.md:6
- **Detail**: `updated` is `2026-06-25`, while this review ran on `2026-06-28`.
- **Fix**: When saving this review, set status to `impl_reviewed` and update the date.
- **Decision**: FIXED - already resolved when the review was saved; `change.md` now has `status: impl_reviewed` and `updated: 2026-06-28`.

## Verification

| Command | Result | Notes |
|---------|--------|-------|
| `dotnet build src/api/frontLineApi.slnx` | PASS | Initial sandbox run failed on NuGet network/SSL; escalated run passed with 0 warnings and 0 errors. |
| `dotnet test src/api/frontLineApi.slnx --no-build` | PASS | Initial sandbox run failed on Windows Event Log access; escalated run passed 11/11 tests. |
| `dotnet test src/api/frontLineApi.slnx --filter Auth` | PASS | Escalated run passed 7/7 tests. |
| `dotnet test src/api/frontLineApi.slnx --filter Results` | PASS | Escalated run passed 5/5 tests. |
| `dotnet test src/api/frontLineApi.slnx` | PASS | Escalated run passed 11/11 tests. |
| `npm run build` | PASS | Angular production build completed. |
| `npm test` | PASS | Vitest run passed 7 files / 13 tests. |
