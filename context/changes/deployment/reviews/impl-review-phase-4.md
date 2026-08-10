<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: OVH Integration and Deployment Plan

- **Plan**: context/changes/deployment/deployment-plan.md
- **Scope**: Phase 4 of 12
- **Date**: 2026-08-10
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Permanent and transient SMTP failures are classified backwards

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/api/Email/SmtpEmailSender.cs:87
- **Detail**: Phase 4 requires retries only for transient SMTP errors. The implementation retries `TransactionFailed` (SMTP 554, a permanent 5xx failure) but treats `ClientNotPermitted` (SMTP 454, a temporary 4xx failure) as non-transient. This can retry a permanent rejection while dropping a recoverable Gmail temporary-authentication or throttling failure. The test at `src/api.Tests/Email/SmtpEmailSenderTests.cs:31` currently locks in the incorrect 454 behavior and has no 554 regression case.
- **Fix**: Classify SMTP 454 as transient and 554 as rejected/permanent, then update the 454 test and add a 554 regression test.
- **Decision**: FIXED — SMTP 454 is now transient, SMTP 554 is rejected without retry, and both boundaries have regression tests.

## Verification Evidence

- `dotnet build src/api/frontLineApi.slnx -c Release --no-restore` — PASS (0 warnings, 0 errors).
- `dotnet test src/api/frontLineApi.slnx -c Release --no-restore` — PASS after the fix (52/52 tests).
- `dotnet ef migrations has-pending-model-changes ...` — PASS (no model changes since the last migration).
- Self-contained Linux EF migration bundle — PASS (`linux-x64`, executable produced).
- `dotnet publish src/api/frontLineApi.csproj -c Release -r linux-x64 --self-contained true -p:UseAppHost=true --no-restore -o artifacts/api` — PASS; Linux `frontLineApi` executable produced.
- `npm test -- --no-progress` — PASS (70/70 tests in 16 files).
- `npm run build` — PASS.
- `npm run build:smoke` with `http://192.0.2.10/api` — PASS.
- `npm run build:android` with `https://api.example.com/api` — PASS.

Generated verification artifacts were removed after their existence was confirmed. The change folder has no `change.md`, so the review status could not be stamped there.
