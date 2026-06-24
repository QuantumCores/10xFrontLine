# Minimal Authenticated Result Contract - Plan Brief

> Full plan: `context/changes/f-01-minimal-authenticated-result-contract/plan.md`

## What & Why

F-01 establishes the first authenticated API contract for Front Line: passwordless email sign-in plus a protected completed-result write endpoint. This unlocks S-01 by making it possible for a signed-in player to finish the first match and save the outcome without building full account history or offline sync.

## Starting Point

The API is scaffold-level with only WeatherForecast, no authentication, no persistence, and no tests. The Angular app is also scaffold-level: empty routes, no HTTP provider, no auth state, and no usable test target despite an `npm test` script.

## Desired End State

A player can request an email code, verify it, receive a JWT, and keep it through a browser-backed storage abstraction. An authenticated client can submit a compact completed-result summary, and retries using the same per-player `clientMatchId` return idempotent success instead of duplicate rows.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Auth scope | Thin client | Proves the backend and Angular contract end-to-end without overbuilding account features. |
| Session model | JWT | Fits simple mobile API calls and the deployment plan's `Authentication__SigningKey` shape. |
| Email delivery | SMTP plus dev/test fake adapter | Keeps production realistic while local development and tests stay deterministic. |
| Result payload | Outcome summary | Captures enough for S-01 and future progression without event-log complexity. |
| Validation | Structural validation | Blocks malformed/duplicate data while keeping gameplay simulation client-owned for MVP. |
| Duplicate handling | Idempotent success | Supports safe retry behavior needed by later offline sync without building sync now. |
| Token storage | Browser storage abstraction | Works now and can be swapped for Capacitor Preferences later. |
| Test scope | Backend integration plus client unit tests | Protects the first security and persistence contracts. |
| History scope | Save-only contract | Unlocks the first match while avoiding full history UI/API scope. |

## Scope

**In scope:**

- Passwordless request-code and verify-code API endpoints
- JWT bearer authentication and protected result-save endpoint
- SQL Server persistence model and first migration for players, codes, and match results
- Production SMTP email adapter plus dev/test fake delivery
- Minimal Angular sign-in/verify flow, auth state, token storage, guard, and result client
- Backend integration tests and client unit tests
- Local examples and documentation for the new contracts

**Out of scope:**

- Full account/profile management
- Match history reads or history UI
- Offline pending-result sync
- Backend-authoritative match simulation
- Capacitor setup, Android packaging, production deployment, and Google Play work

## Architecture / Approach

The API owns identity, code verification, JWT issuance, and result persistence. Angular requests and verifies codes, stores the JWT through an abstraction, attaches it to authenticated API requests, and exposes a save-only result client for the future match loop. SQL Server stores the durable identity/result data; dev/test email delivery stays fake so tests do not need Gmail secrets.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. API Auth and Persistence Foundation | Packages, config, DbContext, entities, services, and API test project | Introducing too much infrastructure before endpoint behavior exists |
| 2. Passwordless Auth Endpoints | Request/verify flow, email adapters, JWT issuance, auth tests | Accidentally leaking account existence or login codes |
| 3. Completed Result Write Contract | Protected save-only endpoint, validation, idempotency, result tests | Over-validating into backend-authoritative simulation |
| 4. Thin Angular Auth and Result Client | Minimal auth UI, token storage, interceptor/guard, result client, client tests | Letting UI polish expand the slice |
| 5. Verification and Documentation Alignment | Local examples, README notes, final builds/tests | Docs drifting from the actual contract |

**Prerequisites:** Existing Angular and API scaffolds remain in place; no production SQL Server or Gmail secrets are required for local/test verification.
**Estimated effort:** Approximately 3-5 focused sessions across 5 phases.

## Open Risks & Assumptions

- EF Core/SQL Server package versions must align with the installed .NET 10 SDK during implementation.
- Angular test tooling must be added or repaired because the project currently has no `test` target in `angular.json`.
- JWT revocation and refresh tokens are intentionally deferred; short token lifetime and future slices should handle stronger session lifecycle if needed.
- Browser storage is an MVP abstraction, not the final Android-native storage choice.

## Success Criteria (Summary)

- A local developer can complete passwordless sign-in without Gmail by using the dev/test email adapter.
- Authenticated result submission saves exactly one row per player and `clientMatchId`, even when retried.
- `dotnet build`, `dotnet test`, `npm run build`, and `npm test` all pass after the change.
