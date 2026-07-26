---
date: 2026-07-26T22:17:21+02:00
researcher: Codex
git_commit: effec4c25a67d3367a78f7594baba73721b8d731
branch: master
repository: TenXFrontLine
topic: "Phase 1: Android session and match restoration"
tags: [research, codebase, angular, capacitor, authentication, match-restoration, testing]
status: complete
last_updated: 2026-07-26
last_updated_by: Codex
---

# Research: Phase 1 Android session and match restoration

**Date**: 2026-07-26T22:17:21+02:00  
**Researcher**: Codex  
**Git Commit**: effec4c25a67d3367a78f7594baba73721b8d731  
**Branch**: master  
**Repository**: TenXFrontLine

## Research Question

Research rollout Phase 1, "Android session and match restoration," from
`context/foundation/test-plan.md` and ground risks #1–#3 in the current code,
test seams, contracts, and prior decisions.

## Summary

The current application does not implement match restoration. A valid local
authentication session can survive Android process recreation only as an
incidental consequence of Angular synchronously reading browser
`localStorage` during cold bootstrap. There is no Capacitor lifecycle adapter,
no persisted in-progress match or pending-result envelope, no engine hydration
entry point, and no response-side 401 handling.

Phase 1 therefore cannot be only a test-writing exercise around existing
behavior. It must first define and expose deterministic restoration behavior:
a versioned, player-owned persisted match with a stable match ID; explicit
clock and randomness continuation rules; durable save boundaries; and a
single-flight reauthentication policy that preserves recoverable game state.
These behaviors can be tested cheaply with Vitest/TestBed and the existing
`WebApplicationFactory` API seam. Browser E2E and native Android instrumentation
are unnecessary for the required signal.

## Detailed Findings

### Android lifecycle and session startup

- Android launches a bare Capacitor `BridgeActivity`; the client has neither
  `@capacitor/app` nor lifecycle listeners. Process death therefore becomes a
  normal Angular cold start, not an application-defined restore event
  ([MainActivity.java:1](../../../src/mbl/android/app/src/main/java/dev/tenxfrontline/app/MainActivity.java#L1),
  [package.json:14](../../../src/mbl/package.json#L14)).
- The root route redirects to `/play`; its guard constructs `AuthStateService`,
  which initializes once from synchronous storage. This ordering restores an
  unexpired local session before the guard runs, but there is no explicit
  initialization contract and the service never rereads storage
  ([app.routes.ts:23](../../../src/mbl/src/app/app.routes.ts#L23),
  [auth.guard.ts:6](../../../src/mbl/src/app/core/auth/auth.guard.ts#L6),
  [auth-state.service.ts:9](../../../src/mbl/src/app/core/auth/auth-state.service.ts#L9)).
- The persisted session is `{ token, expiresAt, player: { id, email } }` under
  `frontLine.authSession`. Malformed data is removed; unavailable browser
  storage silently becomes no session. Writes and clears do not handle storage
  exceptions ([token-storage.service.ts:5](../../../src/mbl/src/app/core/auth/token-storage.service.ts#L5),
  [token-storage.service.ts:17](../../../src/mbl/src/app/core/auth/token-storage.service.ts#L17),
  [token-storage.service.ts:30](../../../src/mbl/src/app/core/auth/token-storage.service.ts#L30)).
- Client validity is only `expiresAt > Date.now()`. It does not prove signature,
  issuer, audience, revocation, or server acceptance, and the computed value has
  no reactive clock dependency. The API independently validates JWT lifetime
  with one minute of clock skew, so client and server acceptance can diverge
  ([auth-state.service.ts:36](../../../src/mbl/src/app/core/auth/auth-state.service.ts#L36),
  [Program.cs:55](../../../src/api/Program.cs#L55)).

### Credential failure and reauthentication

- The HTTP interceptor only attaches a bearer token. It does not translate
  401 responses, invalidate credentials, coordinate concurrent failures, or
  initiate reauthentication
  ([auth.interceptor.ts:7](../../../src/mbl/src/app/core/auth/auth.interceptor.ts#L7)).
- The protected result endpoint returns 401 for invalid credentials, but the
  play page collapses every save error into a generic `failed` state. Its
  pending payload remains only in the live component, with no durable recovery
  or navigation to sign-in
  ([ResultsController.cs:10](../../../src/api/Controllers/ResultsController.cs#L10),
  [play-page.component.ts:58](../../../src/mbl/src/app/play/play-page.component.ts#L58)).
- An anonymous guard redirect already carries `returnUrl` through sign-in and
  verification. That is a reusable seam, but server-side rejection of an
  already-mounted session is not connected to it
  ([auth.guard.ts:10](../../../src/mbl/src/app/core/auth/auth.guard.ts#L10),
  [sign-in.component.ts:32](../../../src/mbl/src/app/auth/sign-in/sign-in.component.ts#L32),
  [verify-code.component.ts:40](../../../src/mbl/src/app/auth/verify-code/verify-code.component.ts#L40)).
- Restoration needs an explicit same-player rule. A local checkpoint can carry
  the original `player.id`; after reauthentication it must resume only for that
  identity, otherwise a different user on the same installation could inherit
  the match.

### Match state, clocks, randomness, and persistence

- `FrontlineMatchScene` privately and eagerly creates a fresh `MatchEngine`.
  Angular supplies only an `onComplete` callback, never receives in-progress
  checkpoints, and cannot provide initial state
  ([frontline-match.scene.ts:34](../../../src/mbl/src/app/play/frontline-match.scene.ts#L34),
  [phaser-game.component.ts:17](../../../src/mbl/src/app/play/phaser-game.component.ts#L17),
  [frontline-game.config.ts:9](../../../src/mbl/src/app/play/frontline-game.config.ts#L9)).
- Component teardown destroys Phaser; remounting constructs a new scene and
  engine. `MatchEngine` has snapshot output but no import, hydrate constructor,
  or restore method
  ([phaser-game.component.ts:67](../../../src/mbl/src/app/play/phaser-game.component.ts#L67),
  [match-engine.ts:16](../../../src/mbl/src/app/play/match-engine.ts#L16),
  [match-engine.ts:103](../../../src/mbl/src/app/play/match-engine.ts#L103)).
- `MatchSnapshot` covers most mutable gameplay fields, but lacks schema/config
  version, owner, stable match identity, checkpoint time, and RNG state. It also
  contains redundant values that could disagree in corrupt data, so a persisted
  DTO needs validation or canonical fields rather than blind deserialization
  ([match-types.ts:16](../../../src/mbl/src/app/play/match-types.ts#L16),
  [match-types.ts:42](../../../src/mbl/src/app/play/match-types.ts#L42)).
- The engine already injects clock, random choice, and NPC selection, which is
  a strong deterministic test seam. Default neutral-pressure NPC choice uses
  `Math.random`; restoring a snapshot without continuing RNG state can yield a
  different future match even when the immediate snapshot is equal
  ([match-engine.ts:16](../../../src/mbl/src/app/play/match-engine.ts#L16),
  [match-engine.ts:169](../../../src/mbl/src/app/play/match-engine.ts#L169)).
- Current timing semantics effectively pause simulation while the app is not
  stepping: Phaser caps each delta at 100 ms and the engine advances only from
  supplied deltas. Phase 1 must preserve that pause policy explicitly or define
  wall-clock catch-up; mixing them would corrupt build timing and NPC cadence
  ([frontline-match.scene.ts:57](../../../src/mbl/src/app/play/frontline-match.scene.ts#L57),
  [match-engine.ts:88](../../../src/mbl/src/app/play/match-engine.ts#L88)).
- There are no save boundaries. Robust process-death protection cannot rely
  only on a pause callback because Android may kill without one. Reasonable
  durable boundaries are accepted player commands, engine-significant
  transitions, lifecycle backgrounding, and a bounded periodic checkpoint—not
  every render frame.

### Stable completion identity and API scope

- `clientMatchId` is generated only after completion. If a restored completion
  emits again after a lost response, it receives a new UUID and bypasses server
  idempotency
  ([match-result-mapper.ts:9](../../../src/mbl/src/app/play/match-result-mapper.ts#L9),
  [play-page.component.ts:48](../../../src/mbl/src/app/play/play-page.component.ts#L48)).
- Server idempotency is correctly scoped to `(PlayerId, ClientMatchId)` and
  requires an identical duplicate payload. A stable ID must therefore be
  created with the match and persisted through restoration, including the
  completed-but-unsaved state
  ([MatchResultService.cs:29](../../../src/api/Results/MatchResultService.cs#L29),
  [FrontLineDbContext.cs:39](../../../src/api/Data/FrontLineDbContext.cs#L39)).
- The API exposes only completed-result persistence; there is no in-progress
  match save/read contract. Local-only restoration is the smallest Phase 1
  scope. Adding server restoration would materially expand ownership and
  authorization work toward Phase 3
  ([ResultsController.cs:10](../../../src/api/Controllers/ResultsController.cs#L10),
  [CompletedResultRequest.cs:5](../../../src/api/Contracts/Results/CompletedResultRequest.cs#L5)).

### Existing test foundation and cheapest useful coverage

- The Angular builder runs Vitest without watch mode. The current baseline is
  green: `npm test -- --no-progress` passed 10 files and 28 tests. Existing
  storage, guard, HTTP-testing, engine, Phaser-factory, and play-page specs
  provide the needed seams
  ([angular.json:92](../../../src/mbl/angular.json#L92),
  [auth.guard.spec.ts:36](../../../src/mbl/src/app/core/auth/auth.guard.spec.ts#L36),
  [results-api.client.spec.ts:30](../../../src/mbl/src/app/core/api/results-api.client.spec.ts#L30),
  [match-engine.spec.ts:56](../../../src/mbl/src/app/play/match-engine.spec.ts#L56)).
- The four authentication-related specs duplicate their own memory-storage
  fixture. A shared persistent fixture can retain one backing store while the
  test tears down and recreates the Angular injector/router, giving a real
  cold-bootstrap integration test instead of mocking the auth state.
- Existing API tests use xUnit, `WebApplicationFactory`, and EF InMemory. They
  cover unauthenticated results, normal auth, payload validation, and result
  idempotency, but not malformed or expired JWTs
  ([frontLineApi.Tests.csproj:4](../../../src/api.Tests/frontLineApi.Tests.csproj#L4),
  [ResultsEndpointTests.cs:16](../../../src/api.Tests/Results/ResultsEndpointTests.cs#L16),
  [AuthWebApplicationFactory.cs:7](../../../src/api.Tests/Auth/AuthWebApplicationFactory.cs#L7)).
- Current API baseline execution is environment-blocked rather than
  product-failing: 26 of 37 tests passed, while 11 HTTP-host tests failed when
  logging attempted to open Windows Event Log without permission. The run also
  emitted `NU1903` for `Microsoft.OpenApi` 2.0.0. Planning should make the test
  host logging deterministic before treating this suite as a required gate.
- Generated Android JUnit/Espresso files are placeholders; the instrumented
  test even asserts a stale package name. They do not provide useful lifecycle
  signal. An injectable Capacitor lifecycle port tested in Vitest is cheaper
  and more deterministic
  ([ExampleInstrumentedTest.java:17](../../../src/mbl/android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java#L17),
  [build.gradle:4](../../../src/mbl/android/app/build.gradle#L4)).

## Code References

- `src/mbl/src/app/core/auth/token-storage.service.ts:5-73` — persisted session
  schema and browser-storage adapter.
- `src/mbl/src/app/core/auth/auth-state.service.ts:9-47` — one-time hydration
  and client-only expiry decision.
- `src/mbl/src/app/core/auth/auth.interceptor.ts:7-20` — bearer attachment with
  no response recovery.
- `src/mbl/src/app/play/match-engine.ts:16-285` — authoritative state machine,
  deterministic inputs, snapshots, and missing hydration path.
- `src/mbl/src/app/play/frontline-match.scene.ts:34-195` — Phaser ownership and
  engine mutation boundary.
- `src/mbl/src/app/play/play-page.component.ts:27-79` — memory-only pending
  result and generic error handling.
- `src/api/Program.cs:55-79` — server JWT validation policy.
- `src/api/Results/MatchResultService.cs:29-113` — completed-result idempotency.
- `src/api.Tests/Results/ResultsEndpointTests.cs:16-142` — current API contract
  coverage and reusable authenticated client flow.

## Architecture Insights

The existing architecture already points toward the right division of
responsibility: `MatchEngine` is authoritative, Phaser renders it, and Angular
owns persistence and HTTP. Restoration should preserve that boundary. An
Angular match-session store can own a versioned checkpoint, stable identity,
player ownership, and pending result; the scene/factory boundary can accept an
initial engine state and publish meaningful checkpoints. Capacitor lifecycle
events should enter through a small injectable port rather than leaking native
APIs into the engine.

The strongest independent equivalence test is behavioral: drive an engine to a
mixed state, persist and hydrate a second engine, assert immediate canonical
state equality, then feed both the same commands, deltas, and scripted random
decisions and compare every later snapshot and completion. This proves future
behavior without copying production calculations into the oracle.

Credential recovery is a state machine, not a redirect side effect. It needs
explicit states for valid, reauthentication required, reauth in flight, resumed,
different-player conflict, and unrecoverable corruption. Auth-session deletion
must be separate from match deletion so a 401 cannot silently destroy progress.

## Historical Context (from prior changes)

- [`f-01-minimal-authenticated-result-contract/plan.md`](../f-01-minimal-authenticated-result-contract/plan.md)
  deliberately selected browser-backed token storage and deferred refresh,
  revocation, match history, and offline queues.
- [`s-01-first-saved-frontline-match/research.md`](../s-01-first-saved-frontline-match/research.md)
  established the pure engine as authoritative, Phaser as renderer, and Angular
  as completed-result persistence owner; durable offline pending work was out of
  scope.
- [`s-01-first-saved-frontline-match/android-verification.md`](../s-01-first-saved-frontline-match/android-verification.md)
  manually verified sign-in, play, save, and an in-memory retry after API
  restart, but did not test backgrounding, process kill, or restoration.
- [`playwright-valid-otp-test-seam/plan.md`](../playwright-valid-otp-test-seam/plan.md)
  focuses on obtaining a valid OTP for manual browser automation. It does not
  supply lifecycle or restoration coverage, and Phase 1 should not add browser
  E2E.
- `context/archive/` contains no relevant archived change beyond its README.

## Related Research

- [`s-01-first-saved-frontline-match/research.md`](../s-01-first-saved-frontline-match/research.md)
  — initial gameplay, result persistence, and Android integration research.

## Open Questions

1. Is Phase 1 explicitly local-only, or should in-progress state sync to the
   API? Local-only is the smallest scope supported by the rollout wording.
2. Does background time pause the simulation, as today, or advance builds and
   NPC cadence using wall time?
3. Will deterministic continuation persist RNG state/seed, or persist enough
   scheduled decisions to make post-restore behavior equivalent?
4. Which exact mutations and interval form the durability boundary that still
   protects against process kill without writing every frame?
5. Is completed-but-unsaved result durability part of Phase 1? Excluding it
   leaves a known loss/duplication window adjacent to risks #2, #3, and #5.
6. What visible policy applies to corrupt checkpoints and reauthentication as a
   different player: quarantine, discard with confirmation, or deny resume?
7. Should API test-host logging be overridden in `WebApplicationFactory`, or
   addressed globally, so HTTP contract tests run without Windows Event Log
   permission?
