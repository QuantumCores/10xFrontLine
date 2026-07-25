# Playwright Valid OTP Test Seam — Plan Brief

> Full plan: `context/changes/playwright-valid-otp-test-seam/plan.md`
> Frame brief: `context/changes/playwright-valid-otp-test-seam/frame.md`

## What & Why

The API has an established captured-email test seam, but it has no safe, deterministic transport across the process boundary to the standalone Playwright run. This plan adds an exact-E2E, localhost-only endpoint that returns the real issued OTP without weakening normal authentication behavior.

## Starting Point

Non-production API hosts already capture outgoing email in singleton `CapturedEmailStore`, and API integration tests read a real code from that store in-process. A separately running `playwright-cli` cannot resolve the API's services, while the only externally visible Development path is raw OTP logging.

## Desired End State

A developer starts a fresh E2E API process with an ephemeral header key, requests a code through the normal UI, retrieves the latest matching OTP exactly once, and fills it into the active Playwright session. The route is absent outside E2E, does not expose whole emails, and leaves random generation, hashing, expiry, consumption, JWT issuance, Angular code, and Development logging unchanged.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Problem boundary | Add cross-process access to captured delivery | Authentication works; the missing piece is the browser-test transport | Frame |
| Endpoint exposure | Map only in exact `E2E` | A generic non-production guard could expose credentials in unintended environments | Frame / Plan |
| Endpoint contract | `POST /api/e2e/auth/login-code` with JSON email | Retrieval changes state and avoids putting email in a URL | Plan |
| Credential protection | Ephemeral `X-FrontLine-E2E-Key` header plus loopback-only access | Prevents an enabled local E2E host from becoming an unauthenticated OTP oracle | Frame / Plan |
| Database | Fresh EF Core InMemory database per E2E process | Keeps the focused login scenario self-contained and deterministic | Plan |
| Retrieval semantics | Atomically take newest and purge older matching captures | Prevents repeat and stale-code retrieval while isolating different recipients | Plan |
| Local operation | Documentation-only, no helper or launch profile | Matches the current step-by-step CLI workflow without adding orchestration tooling | Plan |
| Development logging | Keep unchanged | Preserves the existing Development workflow by explicit user choice | Plan |
| CLI artifacts | Ignore generated `.playwright-cli/` output | Snapshots remain locally useful for active refs but timestamped session output is not stable source | Plan |

## Scope

**In scope:**

- Atomic newest-message retrieval and stale-message removal in `CapturedEmailStore`
- Exact-E2E configuration validation, in-memory database, and conditional endpoint mapping
- Secret-header, loopback, input, no-cache, absence, and one-shot behavior
- Focused store tests and API integration tests
- Two-terminal PowerShell and Playwright CLI documentation
- Ignoring generated `.playwright-cli/` session output

**Out of scope:**

- Master/fixed codes or deterministic OTP generation
- Real email delivery or SMTP inbox testing
- Angular changes or Playwright Test installation/specs
- E2E helper scripts, launch profiles, hooks, or CI
- Development OTP log removal
- Database entities or migrations

## Architecture / Approach

The normal UI calls `request-code`, which persists a salted/peppered hash and sends the plaintext through `CapturingEmailSender`. In exact E2E, a protected minimal endpoint atomically takes the newest matching captured sign-in email and returns only its code. PowerShell holds the per-run key in an environment variable, retrieves the code, and passes only that value to the current Playwright CLI `fill` command; normal `verify-code` then authenticates the user.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Atomic captured retrieval | Deterministic newest-match take-and-purge semantics | A race or stale capture could expose the wrong code |
| 2. Exact-E2E endpoint | Isolated, protected cross-process OTP transport and integration coverage | Mis-gating could expose raw credentials outside E2E |
| 3. Manual workflow and hygiene | Reproducible CLI instructions and clean Git state | Manual secret handling or stale refs could make the workflow brittle |

**Prerequisites:** .NET 10 SDK, Angular dev server dependencies, global `playwright-cli`, and two PowerShell terminals.

**Estimated effort:** Small-to-medium; approximately 1–2 focused implementation sessions across three phases.

## Open Risks & Assumptions

- The E2E host is started with `--no-launch-profile`; otherwise the committed launch profile selects Development.
- Losing a successful retrieval response requires requesting a new OTP because retrieval is intentionally destructive.
- Element refs are active-session identifiers and must be refreshed from the current snapshot.
- The in-memory database intentionally does not verify SQL Server provider behavior; existing API tests and the narrow scenario make that acceptable.
- Existing Development logs continue to expose active OTPs by explicit scope decision and should not be confused with the protected E2E path.

## Success Criteria (Summary)

- The protected endpoint returns a real issued code exactly once and that code succeeds through normal verification.
- The route is absent outside exact E2E and rejects invalid keys, non-loopback callers, mismatched emails, and missing captures without leaking sensitive content.
- A human can follow the documented PowerShell and current-ref Playwright CLI steps to reach `/play`, while generated CLI snapshots remain locally available but untracked.
