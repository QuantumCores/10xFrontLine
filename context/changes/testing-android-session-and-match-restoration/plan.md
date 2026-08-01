# Android Session and Match Restoration Implementation Plan

## Overview

Implement rollout Phase 1 from `context/foundation/test-plan.md` so Android process recreation, locally expired or server-rejected credentials, and interrupted result saving cannot silently strand a player or destroy match progress. The change adds a versioned, player-owned local match session; deterministic engine hydration; bounded lifecycle checkpointing; one durable pending completed result; and single-flight reauthentication backed by client integration and API contract tests.

## Current State Analysis

An unexpired auth session currently survives Android process recreation only because `AuthStateService` synchronously reads `localStorage` during cold Angular bootstrap. Match state does not survive: `FrontlineMatchScene` constructs a fresh engine, `MatchEngine` cannot hydrate a snapshot, and both the active match and failed result payload live only in memory. The HTTP interceptor attaches a bearer token but does not react to 401 responses, so a server-rejected token leaves the play page retrying indefinitely with no reauthentication path.

The existing test seams are useful but incomplete. The engine already accepts clock and random collaborators, `AUTH_STORAGE` is injectable, Phaser creation is factory-backed, and API integration tests authenticate through `WebApplicationFactory`. Phase 1 can therefore provide strong deterministic coverage without browser E2E or Android instrumentation, but it must implement the restoration contracts before those tests can prove them.

## Desired End State

A signed-in player can begin a match, background or terminate the Android app, and return through a cold Angular bootstrap to one equivalent, paused match owned by that player. Immediate restored state and subsequent behavior remain equivalent because the checkpoint includes a stable match ID, schema/config versions, authoritative engine state, and seeded RNG continuation state.

Accepted commands, meaningful engine transitions, app backgrounding, and a bounded five-second interval persist the active checkpoint. Completion atomically replaces the active checkpoint with one durable pending-result envelope; the same payload and `clientMatchId` are retried until the API confirms success. A server-side 401 invalidates credentials without erasing progress, starts one reauthentication flow, and resumes automatically only for the same player. Signing in as a different player or explicitly signing out deletes the prior player's active and pending match state. Corrupt or unsupported persisted data is silently discarded and a fresh match starts.

### Key Discoveries:

- `AuthStateService` performs one synchronous storage read and trusts only local `expiresAt`, while the API independently validates the JWT with issuer, audience, signature, and lifetime rules (`src/mbl/src/app/core/auth/auth-state.service.ts:9`, `src/api/Program.cs:55`).
- `authInterceptor` attaches bearer credentials but has no response recovery or concurrent-401 coordination (`src/mbl/src/app/core/auth/auth.interceptor.ts:7`).
- `MatchEngine` exposes `getSnapshot()` and deterministic collaborators but always initializes fresh state and uses `Math.random` by default (`src/mbl/src/app/play/match-engine.ts:16`, `src/mbl/src/app/play/match-engine.ts:103`).
- The scene privately owns the engine and caps frame delta at 100 ms, establishing paused rather than wall-clock background semantics (`src/mbl/src/app/play/frontline-match.scene.ts:34`, `src/mbl/src/app/play/frontline-match.scene.ts:57`).
- Result identity is generated after completion and retained only in the mounted play component, despite server idempotency being scoped to `(PlayerId, ClientMatchId)` (`src/mbl/src/app/play/match-result-mapper.ts:9`, `src/mbl/src/app/play/play-page.component.ts:48`, `src/api/Results/MatchResultService.cs:29`).
- `AUTH_STORAGE` and the Phaser factory are injectable, providing deterministic cold-bootstrap and lifecycle integration seams (`src/mbl/src/app/core/auth/token-storage.service.ts:17`, `src/mbl/src/app/play/phaser-game.component.ts:17`).
- The API test host can avoid Windows Event Log permission failures by following the existing E2E factory's `ClearProviders()` pattern (`src/api.Tests/E2E/E2eWebApplicationFactory.cs:19`).

## What We're NOT Doing

- No server-side in-progress match schema, save/read endpoint, cross-device restoration, or backend-authoritative simulation.
- No multi-result offline queue, scheduled connectivity retry service, match history, or full S-03 resilient-sync implementation.
- No wall-clock simulation catch-up while the app is backgrounded or terminated.
- No transfer of a checkpoint or pending result between player identities.
- No migration of corrupt or unsupported checkpoint versions; they are discarded and replaced with fresh state.
- No browser E2E, Playwright specs, Android JUnit/Espresso instrumentation, pixel snapshots, or Phaser animation-frame assertions.
- No gameplay balance, NPC strategy, match feedback, restart/play-again, or layout changes.
- No CI/CD or local hook configuration; test-gate automation remains rollout Phase 4 in `context/foundation/test-plan.md`.
- No writes to `context/archive/`.

## Implementation Approach

Preserve the existing ownership boundary: the pure TypeScript engine remains authoritative, Phaser renders snapshots and forwards commands, and Angular owns lifecycle, local persistence, auth recovery, and API calls. Create the stable `clientMatchId` when a match session starts, not after completion. Persist a validated envelope rather than serializing `MatchSnapshot` blindly; the envelope carries schema/config versions, owner ID, match ID, seeded RNG continuation state, checkpoint metadata, and either an active engine checkpoint or one exact pending result.

Hydrate the engine through an explicit constructor/factory contract and prove behavioral equivalence by driving uninterrupted and restored engines with identical commands and deltas. Phaser publishes authoritative checkpoints after accepted commands, engine-significant transitions, and at a coalesced five-second interval. An injectable lifecycle adapter adds an immediate background save without leaking Capacitor APIs into the engine.

Treat credential recovery as application state. The response-side auth path distinguishes 401 from ordinary save/network failures, invalidates only credentials, and starts at most one safe internal redirect through the existing `returnUrl` flow. The persisted match remains available during reauthentication; successful same-player verification restores `/play`, where the pending result or active match resumes. Different-player verification and explicit logout clear both active and pending match state.

## Critical Implementation Details

### Timing & lifecycle

Background time is paused. A restored engine continues from persisted `elapsedMs`; it must never add wall-clock time between `checkpointedAt` and bootstrap. Lifecycle callbacks are an extra save boundary, not the only one, because Android can terminate the process without delivering a final pause event.

### State sequencing

Match completion must persist the pending result before deleting the active checkpoint, and API success must delete the pending envelope only after the response is accepted. A 401 may clear auth credentials but must not clear match data until verification identifies a different player or the player explicitly signs out.

### Debug & observability

Invalid JSON, invalid invariants, and unsupported schema/config versions are removed from the active storage key and treated as no restorable match. Tests should assert the fallback without logging tokens, player email, full result payloads, or checkpoint contents.

## Phase 1: Restorable Engine and Session Contracts

### Overview

Define and test the authoritative engine hydration, deterministic randomness, stable identity, and versioned local envelope contracts before wiring them into Phaser or lifecycle events.

### Changes Required:

#### 1. Persisted session contracts

**File**: `src/mbl/src/app/core/session/match-session.types.ts`

**Intent**: Define a versioned, player-owned persistence shape that distinguishes an active match from one completed-but-unsaved result and rejects contradictory state.

**Contract**: The envelope includes schema version, match-config version, owner player ID, stable `clientMatchId`, checkpoint timestamp, and exactly one state variant: active engine checkpoint or pending `CompletedResultRequest`. The active variant contains only authoritative fields needed to hydrate the engine, including seeded RNG continuation state; redundant derived values are validated or recomputed.

#### 2. Seeded random continuation

**File**: `src/mbl/src/app/play/match-random.ts`

**Intent**: Replace untracked default randomness with a small deterministic generator whose state can cross process recreation.

**Contract**: Expose seed creation, next-value generation, and serializable continuation state. A newly created match receives one seed; hydration resumes from the persisted state. Invalid states are rejected rather than normalized into a different sequence.

#### 3. Match type and config version contracts

**File**: `src/mbl/src/app/play/match-types.ts`

**Intent**: Separate render snapshots from the authoritative persisted checkpoint and expose stable match identity where completion mapping needs it.

**Contract**: Add the engine-checkpoint types used by hydration without turning the transient `MatchSnapshot` into the storage DTO. Preserve existing scene-facing snapshot fields and completion summary behavior.

**File**: `src/mbl/src/app/play/match-config.ts`

**Intent**: Give persisted checkpoints an explicit compatibility boundary without changing balance.

**Contract**: Export a match-config version that changes when persisted engine semantics become incompatible; existing strengths, timings, cadence, and boundaries remain unchanged.

#### 4. Engine hydration

**File**: `src/mbl/src/app/play/match-engine.ts`

**Intent**: Allow a fresh engine instance to restore one validated checkpoint and continue identically to an uninterrupted engine.

**Contract**: Add an explicit new-match versus hydrate path. Hydration restores elapsed time, frontline position, pressures, builds, held units, NPC scheduling/counts, completion state when applicable, and RNG continuation state. It defensively copies input, validates invariants and config compatibility, and retains the existing clock/decision test seams.

#### 5. Session storage adapter

**File**: `src/mbl/src/app/core/session/match-session.store.ts`

**Intent**: Own serialization, validation, player lookup, atomic active-to-pending replacement, confirmed-result removal, and destructive cleanup policies independently of auth token storage.

**Contract**: Use an injectable local `StorageLike` adapter and a dedicated key. Reads return a validated same-player envelope or no session; malformed, corrupt, or unsupported data is silently removed. Writes coalesce equivalent checkpoints. Provide explicit operations to save active state, promote to pending, confirm pending, clear one owner's state, and clear all match state on logout/different-player recovery.

#### 6. Shared persistent storage fixture

**File**: `src/mbl/src/testing/persistent-memory-storage.ts`

**Intent**: Replace duplicated private memory-storage fixtures with one backing store that can survive TestBed teardown and injector recreation.

**Contract**: Implement the existing `StorageLike` interface, deterministic fault injection where needed, and direct seeding/inspection helpers for specs; production code does not import this fixture.

#### 7. Engine and store specifications

**File**: `src/mbl/src/app/play/match-engine.spec.ts`

**Intent**: Prove checkpoint round trips and future behavioral equivalence without copying production calculations into expected values.

**Contract**: Drive an engine to mixed player/NPC state, hydrate a second engine, compare canonical state, then feed both the same commands and deltas and compare every subsequent snapshot, RNG-dependent NPC choice, and completion. Cover invalid invariants and config-version mismatch.

**File**: `src/mbl/src/app/core/session/match-session.store.spec.ts`

**Intent**: Pin envelope validation, stable identity, owner isolation, active-to-pending sequencing, confirmation cleanup, corrupt-data discard, and storage-failure behavior.

**Contract**: Tests cover active round trip, one pending result, exact payload retention, wrong-owner denial, unsupported/corrupt removal, no simultaneous active/pending variants, logout cleanup, and a fresh store instance reading the same backing storage.

### Success Criteria:

#### Automated Verification:

- Engine restoration specs pass from `src/mbl`: `npm test -- --include src/app/play/match-engine.spec.ts`
- Match-session store specs pass from `src/mbl`: `npm test -- --include src/app/core/session/match-session.store.spec.ts`
- Angular lint passes from `src/mbl`: `npm run lint`
- Angular production build passes from `src/mbl`: `npm run build`

#### Manual Verification:

- Code review confirms persisted DTOs are versioned and distinct from render snapshots
- Code review confirms balance constants are unchanged and RNG continuation is owned by the match session

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation of the persistence and deterministic-continuation contracts before wiring runtime lifecycle behavior.

---

## Phase 2: Durable Lifecycle Checkpointing

### Overview

Connect the engine, Phaser host, Angular page, and Capacitor lifecycle so an active paused match is saved at meaningful boundaries and restored after cold process recreation.

### Changes Required:

#### 1. Capacitor lifecycle dependency

**File**: `src/mbl/package.json`

**Intent**: Add the official Capacitor App plugin compatible with the existing Capacitor 8 packages.

**Contract**: Add `@capacitor/app` through npm and update `src/mbl/package-lock.json` mechanically; no manual lockfile edits and no native activity customization.

#### 2. Injectable application lifecycle port

**File**: `src/mbl/src/app/core/lifecycle/app-lifecycle.service.ts`

**Intent**: Translate Capacitor foreground/background signals into an Angular-testable stream without exposing native APIs to the engine or scene.

**Contract**: Register and remove the App plugin listener safely, expose foreground/background events, tolerate browser execution, and avoid duplicate listeners across service consumers. Background events request an immediate checkpoint; foreground events do not advance simulation time.

**File**: `src/mbl/src/app/core/lifecycle/app-lifecycle.service.spec.ts`

**Intent**: Prove listener registration, event translation, teardown, browser fallback, and deduplication using an injected plugin adapter.

**Contract**: Specs use no Android runtime and leave no live listeners or timers after teardown.

#### 3. Scene checkpoint boundary

**File**: `src/mbl/src/app/play/frontline-match.scene.ts`

**Intent**: Accept restored engine state and publish authoritative checkpoints without making Phaser responsible for persistence.

**Contract**: Scene options accept new-match/hydrated engine input and an `onCheckpoint` callback. Publish after accepted player commands, player/NPC build completion or NPC send/start transitions, match completion, and no less safely than a coalesced five-second active-play interval. Rendering and input behavior remain unchanged.

#### 4. Phaser configuration and host bridge

**File**: `src/mbl/src/app/play/frontline-game.config.ts`

**Intent**: Carry initial state and checkpoint callbacks through the existing lazy Phaser factory boundary.

**Contract**: Extend the factory/config signature with one session input and checkpoint output while preserving one Phaser game per mounted host.

**File**: `src/mbl/src/app/play/phaser-game.component.ts`

**Intent**: Expose restored session input and checkpoint output to Angular and guarantee a final best-effort checkpoint before game destruction.

**Contract**: Add typed input/output contracts, preserve single completion emission and async-factory teardown safety, and do not recreate the game in response to emitted checkpoints.

**File**: `src/mbl/src/app/play/phaser-game.component.spec.ts`

**Intent**: Verify restored input forwarding, checkpoint propagation, one game instance, and teardown behavior through the factory seam.

#### 5. Play-page session orchestration

**File**: `src/mbl/src/app/play/play-page.component.ts`

**Intent**: Load the current player's restorable session before mounting Phaser, create a stable match identity for a new match, persist published checkpoints, and flush on backgrounding.

**Contract**: A valid active envelope hydrates the game; no envelope creates one new session and `clientMatchId`. Checkpoints are player-owned and use paused time. Lifecycle subscriptions and timers are disposed with the component. Corrupt/unsupported data produces a fresh match without a user notice.

**File**: `src/mbl/src/app/play/play-page.component.html`

**Intent**: Delay game-host creation until session initialization resolves without changing the established mobile layout.

**Contract**: Render the existing game surface once initial state is ready; do not introduce new gameplay controls, banners, or layout shifts.

#### 6. Lifecycle restoration integration specs

**File**: `src/mbl/src/app/play/play-page.component.spec.ts`

**Intent**: Prove accepted checkpoints and background signals persist the current session and that cold remount passes it back to Phaser.

**Contract**: Recreate the TestBed/component over one backing storage instance; assert the same owner, match ID, elapsed time, and RNG state return, no wall-clock catch-up occurs, and the periodic boundary does not write more often than every five seconds.

### Success Criteria:

#### Automated Verification:

- Lifecycle adapter specs pass from `src/mbl`: `npm test -- --include src/app/core/lifecycle/app-lifecycle.service.spec.ts`
- Phaser host and play-page restoration specs pass from `src/mbl`: `npm test -- --include src/app/play/phaser-game.component.spec.ts --include src/app/play/play-page.component.spec.ts`
- Full Angular test suite passes from `src/mbl`: `npm test -- --no-progress`
- Angular lint and production build pass from `src/mbl`: `npm run lint` and `npm run build`
- Capacitor Android sync succeeds from `src/mbl`: `npx cap sync android`

#### Manual Verification:

- Browser refresh during an active match restores the same paused match and stable match ID
- Android background/foreground smoke check resumes without elapsed-time catch-up or duplicated Phaser instances
- Existing portrait layout, touch alignment, and match feedback remain unchanged

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation of browser and Android lifecycle behavior before adding credential recovery.

---

## Phase 3: Pending Result and Credential Recovery

### Overview

Make completion durable and connect server-rejected credentials to one non-destructive reauthentication flow with the selected ownership and deletion policies.

### Changes Required:

#### 1. Stable completion promotion and retry

**File**: `src/mbl/src/app/play/match-result-mapper.ts`

**Intent**: Map completion with the match session's existing `clientMatchId` instead of generating identity after completion.

**Contract**: Require the stable match ID supplied by session orchestration; identical retries reuse the exact persisted request, including `completedAt`.

**File**: `src/mbl/src/app/play/play-page.component.ts`

**Intent**: Atomically promote completion to one pending result before saving, resume a pending result after process recreation or reauthentication, and clear it only after API success.

**Contract**: A pending envelope prevents a fresh engine from starting. Network/server failures retain it and keep manual retry available. A 401 enters auth recovery rather than generic retry; successful same-player return automatically retries/resumes once.

#### 2. Authentication recovery coordinator

**File**: `src/mbl/src/app/core/auth/auth-recovery.service.ts`

**Intent**: Own the single-flight state machine for server-rejected credentials and safe return to the restorable play route.

**Contract**: States cover idle, reauthentication required/in flight, same-player resumed, different-player cleared, and explicit logout. Concurrent 401 reports create one credential invalidation and one navigation to `/sign-in?returnUrl=%2Fplay`. Auth endpoints themselves do not recursively trigger recovery.

**File**: `src/mbl/src/app/core/auth/auth.interceptor.ts`

**Intent**: Detect protected API 401 responses while preserving current bearer attachment and ordinary error propagation.

**Contract**: Report qualifying 401s to the recovery coordinator exactly once per recovery episode; do not clear match storage, swallow the response, retry requests blindly, or react to request-code/verify-code failures.

#### 3. Credential invalidation and identity resolution

**File**: `src/mbl/src/app/core/auth/auth-state.service.ts`

**Intent**: Separate server-driven credential invalidation from explicit logout so progress survives only the former.

**Contract**: Add an idempotent invalidation operation that clears persisted/in-memory auth even when storage operations fail, without touching match state. Keep explicit session start identity available to the recovery coordinator.

**File**: `src/mbl/src/app/core/auth/auth.service.ts`

**Intent**: Apply destructive local-match cleanup only for explicit logout and coordinate verified identity after reauthentication.

**Contract**: Explicit logout deletes active and pending match state before navigating away. Verification as the original player completes recovery; verification as another player deletes the original checkpoint/pending result and starts that player without inherited state.

#### 4. Existing return-path flow

**File**: `src/mbl/src/app/auth/sign-in/sign-in.component.ts`

**Intent**: Preserve the single recovery return URL through code request without opening an external redirect surface.

**Contract**: Accept only safe internal application paths and preserve `/play` once through verification.

**File**: `src/mbl/src/app/auth/verify-code/verify-code.component.ts`

**Intent**: Resolve same-player versus different-player recovery before navigating back to play.

**Contract**: On success, notify the coordinator with the verified player ID, apply the selected deletion policy, and navigate once to the normalized internal return URL.

#### 5. Authentication and pending-result integration specs

**File**: `src/mbl/src/app/core/auth/auth.interceptor.spec.ts`

**Intent**: Prove qualifying 401 detection, non-API/auth-endpoint exclusions, and single-flight handling across concurrent failures.

**Contract**: Use `HttpTestingController` with real auth state/recovery services; assert one invalidation/navigation episode, preserved match storage, and ordinary propagation of 401 and non-401 errors.

**File**: `src/mbl/src/app/core/auth/auth-recovery.service.spec.ts`

**Intent**: Pin same-player resume, different-player deletion, explicit logout deletion, safe return URL, and repeated-event idempotency.

**Contract**: Tests recreate auth services over persistent storage and never mock away the ownership comparison.

**File**: `src/mbl/src/app/play/play-page.component.spec.ts`

**Intent**: Prove completion persistence precedes save, failed/401 saves survive recreation, automatic same-player retry uses the identical payload, and confirmed saves clear pending state.

**Contract**: Cover network failure, 401, cold remount, successful retry, different-player deletion, explicit logout deletion, and prevention of duplicate fresh matches while pending work exists.

### Success Criteria:

#### Automated Verification:

- Auth recovery and interceptor specs pass from `src/mbl`: `npm test -- --include src/app/core/auth/auth-recovery.service.spec.ts --include src/app/core/auth/auth.interceptor.spec.ts`
- Pending-result play-page specs pass from `src/mbl`: `npm test -- --include src/app/play/play-page.component.spec.ts`
- Auth component and service regression specs pass from `src/mbl`: `npm test -- --include src/app/core/auth/auth.service.spec.ts --include src/app/auth/sign-in/sign-in.component.spec.ts --include src/app/auth/verify-code/verify-code.component.spec.ts`
- Full Angular test suite, lint, and production build pass from `src/mbl`: `npm test -- --no-progress`, `npm run lint`, and `npm run build`

#### Manual Verification:

- A forced result-save 401 preserves the active or pending match and opens only one sign-in flow
- Reauthenticating as the same player returns to `/play` and automatically resumes or retries the preserved work
- Reauthenticating as another player and explicitly signing out each remove the previous player's active and pending match state

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation of same-player recovery and destructive different-player/logout behavior.

---

## Phase 4: Risk-Focused Contract Verification and Handoff

### Overview

Complete the rollout evidence for risks #1-#3, stabilize the API integration host, record Android verification, and replace the Phase 1 cookbook placeholder with verified test patterns.

### Changes Required:

#### 1. Deterministic API test hosting

**File**: `src/api.Tests/Auth/AuthWebApplicationFactory.cs`

**Intent**: Remove environment-specific Windows Event Log failures from required auth/results contract tests.

**Contract**: Clear host logging providers in the Testing factory following the existing E2E factory pattern, without changing production application logging.

#### 2. Invalid credential result contracts

**File**: `src/api.Tests/Auth/TestJwtFactory.cs`

**Intent**: Create deterministic signed test tokens for lifetime and signature rejection cases that cannot be expressed through the normal clamped issuance path.

**Contract**: Generate only test-host tokens with controlled claims, issuer, audience, signing key, and validity window; do not add production token-generation behavior.

**File**: `src/api.Tests/Results/ResultsEndpointTests.cs`

**Intent**: Prove malformed, expired, and otherwise rejected credentials cannot save a pending result and return the 401 contract expected by client recovery.

**Contract**: Add negative HTTP cases for malformed and expired JWTs and preserve existing unauthenticated, authenticated, validation, idempotent, and conflict assertions. Cross-player resource access remains rollout Phase 3, outside this change.

#### 3. Cold-bootstrap restoration integration suite

**File**: `src/mbl/src/app/session-restoration.integration.spec.ts`

**Intent**: Exercise real auth storage, match-session storage, routing, lifecycle adapter, and play orchestration across Angular injector recreation.

**Contract**: Cover valid-session cold bootstrap, active-match restore, paused timing, equivalent continuation, pending-result restore, 401 single-flight reauthentication, same-player automatic resume, corrupt-data fresh start, different-player deletion, and explicit logout deletion. Mock network and Phaser construction only at established external seams.

#### 4. Testing cookbook update

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the Phase 1 cookbook placeholder with the stable fixtures, commands, and reference specs delivered by this rollout without changing the frozen risk strategy.

**Contract**: Update only Phase 1 status and §6.1/per-phase notes with the verified persistent-storage fixture, engine equivalence oracle, lifecycle adapter pattern, 401 recovery contract, and focused/full commands. Do not alter risks, priorities, or later rollout scope.

#### 5. Android verification record

**File**: `context/changes/testing-android-session-and-match-restoration/android-verification.md`

**Intent**: Record human Android evidence for background/foreground and cold process recreation without creating native instrumentation.

**Contract**: Document date, verifier, emulator/device, commands, process recreation method, same-player recovery, pending-result retry, different-player/logout deletion checks, and any environment blockers. Do not claim unperformed verification.

### Success Criteria:

#### Automated Verification:

- Cold-bootstrap restoration integration spec passes from `src/mbl`: `npm test -- --include src/app/session-restoration.integration.spec.ts`
- Full Angular tests, lint, and production build pass from `src/mbl`: `npm test -- --no-progress`, `npm run lint`, and `npm run build`
- Results credential contract tests pass: `dotnet test src/api/frontLineApi.slnx --filter FullyQualifiedName~ResultsEndpointTests`
- Full API test suite and build pass: `dotnet test src/api/frontLineApi.slnx` and `dotnet build src/api/frontLineApi.slnx`
- Capacitor Android sync succeeds from `src/mbl`: `npx cap sync android`
- Test-plan Phase 1 cookbook no longer contains its restoration placeholder

#### Manual Verification:

- Android process recreation restores an active paused match for the same player without another match being created
- Android process recreation restores and submits the exact pending completed-result payload once connectivity and valid credentials are available
- A forced 401 opens one reauthentication flow; same-player verification resumes, while different-player verification and explicit logout delete prior match state
- `android-verification.md` records the environment, steps, outcomes, and any limitations truthfully

**Implementation Note**: After all automated verification passes, pause for the human Android checks and verification record before considering rollout Phase 1 complete.

---

## Testing Strategy

### Unit Tests:

- Validate seeded RNG round trips and rejection of impossible continuation state.
- Validate checkpoint invariants, schema/config versions, ownership, atomic active-to-pending promotion, confirmed deletion, and silent corrupt-data removal.
- Prove engine immediate-state and future-behavior equivalence after hydration using the same commands and deltas.
- Verify lifecycle listener translation, five-second write coalescing, teardown, and browser fallback.
- Verify auth recovery state transitions, safe return URLs, same/different-player policies, and explicit logout cleanup.

### Integration Tests:

- Recreate Angular injectors/components over one backing storage instance to model Android cold bootstrap.
- Exercise real auth and match-session services while mocking only HTTP and Phaser factory boundaries.
- Prove a pending result survives process recreation and reuses the exact stable payload through API success.
- Exercise malformed and expired JWT rejection through `WebApplicationFactory` and the real protected results endpoint.
- Keep Phaser frame rendering, browser E2E, and Android instrumentation outside the suite.

### Manual Testing Steps:

1. Build and sync the Angular application to an Android emulator or device.
2. Sign in, begin a match, create mixed build/held/NPC state, background and foreground the app, and confirm paused restoration.
3. Recreate or force-stop the application process, reopen it, and confirm the same match ID and visible state resume without wall-clock catch-up.
4. Complete a match while result saving is unavailable, recreate the process, restore connectivity, and confirm the exact pending result saves once.
5. Force a protected request to return 401 and confirm one sign-in flow appears while progress remains stored.
6. Reauthenticate as the same player and confirm automatic return to the active match or pending-result retry.
7. Repeat recovery as another player and confirm the original active/pending state is deleted and not exposed.
8. Start another active match, explicitly sign out, sign back in, and confirm the prior match state was deleted.
9. Record the device, commands, observations, and limitations in `android-verification.md`.

## Performance Considerations

Checkpoints are small local JSON envelopes. Coalesce periodic writes to one per five seconds and skip byte-equivalent state so frame updates never write storage continuously. Accepted commands, meaningful transitions, and backgrounding may flush immediately. Hydration and validation must remain linear in the fixed-size match state; no cache, worker, compression, or database is warranted.

## Migration Notes

This introduces the first match-session schema at version 1 and does not modify the API database. Unsupported future or stale versions are intentionally deleted rather than migrated. Rolling back the client change leaves a harmless dedicated local-storage key; rollback cleanup may remove that key, but must not edit EF migrations or production data. Package changes are limited to the Capacitor App plugin and its npm lockfile entries.

## References

- Research baseline: `context/changes/testing-android-session-and-match-restoration/research.md`
- Risk strategy and rollout contract: `context/foundation/test-plan.md`
- Product requirements: `context/foundation/prd.md`
- Resilient-result-sync boundary: `context/foundation/roadmap.md`
- Existing engine: `src/mbl/src/app/play/match-engine.ts:16`
- Existing scene ownership: `src/mbl/src/app/play/frontline-match.scene.ts:34`
- Existing auth hydration: `src/mbl/src/app/core/auth/auth-state.service.ts:9`
- Existing bearer interceptor: `src/mbl/src/app/core/auth/auth.interceptor.ts:7`
- Existing result idempotency: `src/api/Results/MatchResultService.cs:29`
- Existing deterministic logging precedent: `src/api.Tests/E2E/E2eWebApplicationFactory.cs:19`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Restorable Engine and Session Contracts

#### Automated

- [x] 1.1 Engine restoration specs pass from `src/mbl`: `npm test -- --include src/app/play/match-engine.spec.ts` — 069a100
- [x] 1.2 Match-session store specs pass from `src/mbl`: `npm test -- --include src/app/core/session/match-session.store.spec.ts` — 069a100
- [x] 1.3 Angular lint passes from `src/mbl`: `npm run lint` — 069a100
- [x] 1.4 Angular production build passes from `src/mbl`: `npm run build` — 069a100

#### Manual

- [x] 1.5 Code review confirms persisted DTOs are versioned and distinct from render snapshots — 069a100
- [x] 1.6 Code review confirms balance constants are unchanged and RNG continuation is owned by the match session — 069a100

### Phase 2: Durable Lifecycle Checkpointing

#### Automated

- [x] 2.1 Lifecycle adapter specs pass from `src/mbl`: `npm test -- --include src/app/core/lifecycle/app-lifecycle.service.spec.ts` — 571ba3f
- [x] 2.2 Phaser host and play-page restoration specs pass from `src/mbl`: `npm test -- --include src/app/play/phaser-game.component.spec.ts --include src/app/play/play-page.component.spec.ts` — 571ba3f
- [x] 2.3 Full Angular test suite passes from `src/mbl`: `npm test -- --no-progress` — 571ba3f
- [x] 2.4 Angular lint and production build pass from `src/mbl`: `npm run lint` and `npm run build` — 571ba3f
- [x] 2.5 Capacitor Android sync succeeds from `src/mbl`: `npx cap sync android` — 571ba3f

#### Manual

- [x] 2.6 Browser refresh during an active match restores the same paused match and stable match ID — 571ba3f
- [x] 2.7 Android background/foreground smoke check resumes without elapsed-time catch-up or duplicated Phaser instances — 571ba3f
- [x] 2.8 Existing portrait layout, touch alignment, and match feedback remain unchanged — 571ba3f

### Phase 3: Pending Result and Credential Recovery

#### Automated

- [ ] 3.1 Auth recovery and interceptor specs pass from `src/mbl`: `npm test -- --include src/app/core/auth/auth-recovery.service.spec.ts --include src/app/core/auth/auth.interceptor.spec.ts`
- [ ] 3.2 Pending-result play-page specs pass from `src/mbl`: `npm test -- --include src/app/play/play-page.component.spec.ts`
- [ ] 3.3 Auth component and service regression specs pass from `src/mbl`: `npm test -- --include src/app/core/auth/auth.service.spec.ts --include src/app/auth/sign-in/sign-in.component.spec.ts --include src/app/auth/verify-code/verify-code.component.spec.ts`
- [ ] 3.4 Full Angular test suite, lint, and production build pass from `src/mbl`: `npm test -- --no-progress`, `npm run lint`, and `npm run build`

#### Manual

- [ ] 3.5 A forced result-save 401 preserves the active or pending match and opens only one sign-in flow
- [ ] 3.6 Reauthenticating as the same player returns to `/play` and automatically resumes or retries the preserved work
- [ ] 3.7 Reauthenticating as another player and explicitly signing out each remove the previous player's active and pending match state

### Phase 4: Risk-Focused Contract Verification and Handoff

#### Automated

- [ ] 4.1 Cold-bootstrap restoration integration spec passes from `src/mbl`: `npm test -- --include src/app/session-restoration.integration.spec.ts`
- [ ] 4.2 Full Angular tests, lint, and production build pass from `src/mbl`: `npm test -- --no-progress`, `npm run lint`, and `npm run build`
- [ ] 4.3 Results credential contract tests pass: `dotnet test src/api/frontLineApi.slnx --filter FullyQualifiedName~ResultsEndpointTests`
- [ ] 4.4 Full API test suite and build pass: `dotnet test src/api/frontLineApi.slnx` and `dotnet build src/api/frontLineApi.slnx`
- [ ] 4.5 Capacitor Android sync succeeds from `src/mbl`: `npx cap sync android`
- [ ] 4.6 Test-plan Phase 1 cookbook no longer contains its restoration placeholder

#### Manual

- [ ] 4.7 Android process recreation restores an active paused match for the same player without another match being created
- [ ] 4.8 Android process recreation restores and submits the exact pending completed-result payload once connectivity and valid credentials are available
- [ ] 4.9 A forced 401 opens one reauthentication flow; same-player verification resumes, while different-player verification and explicit logout delete prior match state
- [ ] 4.10 `android-verification.md` records the environment, steps, outcomes, and any limitations truthfully
