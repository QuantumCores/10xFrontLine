# Android Session and Match Restoration — Plan Brief

> Full plan: `context/changes/testing-android-session-and-match-restoration/plan.md`
> Research: `context/changes/testing-android-session-and-match-restoration/research.md`

## What & Why

Implement and prove that Android process recreation and credential failure cannot strand a legitimate player or silently destroy match progress. The change covers rollout risks #1-#3 with deterministic client integration, lifecycle unit, and client/API contract tests rather than browser E2E or native instrumentation.

## Starting Point

Auth happens to survive cold startup through synchronous browser storage, but active match state, RNG continuation, and failed result payloads exist only in memory. The engine cannot hydrate, Phaser always creates a fresh engine, and a protected API 401 produces only a generic retry failure.

## Desired End State

A same-player cold bootstrap restores one equivalent, paused match with stable identity and deterministic future behavior. Completion becomes one durable pending result until API success, and server-rejected credentials trigger one reauthentication flow without deleting progress. Different-player verification, explicit logout, corrupt data, and unsupported versions apply the chosen destructive cleanup policies.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Checkpoint location | Local installation only | Avoids new backend ownership and sync scope | Plan |
| Background time | Pause simulation | Preserves existing frame-driven behavior | Plan |
| Random continuation | Persist seeded RNG state | Proves future behavior, not only immediate snapshot equality | Plan |
| Save boundaries | Commands, transitions, background, five-second interval | Protects abrupt process death without per-frame writes | Plan |
| Completed result | One durable pending envelope | Closes the completion-to-save loss window without building S-03's queue | Plan |
| Corrupt/version mismatch | Discard silently | Avoids restore loops with no added recovery UX | Plan |
| Different player | Delete original match state | Prevents cross-player restoration and dormant ownership | Plan |
| Reauthentication | Single-flight, then automatic same-player resume | Prevents redirect loops while preserving progress | Plan |
| Explicit logout | Delete active and pending state | Makes logout a clear local-data boundary | Plan |
| Test layer | Vitest/TestBed plus API contracts | Provides cheaper deterministic signal than E2E or instrumentation | Research |

## Scope

**In scope:**

- Versioned, player-owned active and pending-result envelopes
- Stable match identity, seeded RNG, engine hydration, and invariant validation
- Accepted-command, transition, background, and bounded periodic checkpoints
- Capacitor lifecycle adapter and cold-bootstrap restoration
- One durable completed-result retry payload
- Single-flight 401 recovery and same-player automatic resume
- Different-player/logout cleanup and silent corrupt-data fallback
- Client integration, lifecycle unit, API credential contract, and Android manual verification

**Out of scope:**

- Server-side or cross-device match restoration
- Multi-result offline queue or full S-03 synchronization
- Wall-clock catch-up, gameplay changes, restart flow, or UI redesign
- Browser E2E, Playwright specs, Android instrumentation, pixel snapshots, CI, or hooks

## Architecture / Approach

The pure engine remains authoritative and gains explicit new/hydrate paths plus serializable RNG continuation. Phaser continues to render and forward commands while publishing authoritative checkpoint events. Angular owns the versioned local store, lifecycle flushes, pending result, identity policy, and auth recovery; the API remains a completed-result endpoint whose 401 and idempotency contracts are tested.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Restorable contracts | Hydratable engine, seeded RNG, versioned session store | Persisting contradictory or non-deterministic state |
| 2. Lifecycle checkpointing | Bounded saves and cold paused restoration through Phaser/Angular | Excess writes or duplicate game instances |
| 3. Result and auth recovery | Durable pending result and single-flight reauthentication | Loops, cross-player exposure, or premature deletion |
| 4. Verification and handoff | Full risk tests, stable API host, cookbook, Android record | Claiming lifecycle safety without reproducible evidence |

**Prerequisites:** Existing S-01 match engine/Phaser integration, auth flow, protected result endpoint, and completed research artifact.
**Estimated effort:** Approximately 4-6 focused implementation sessions across four phases, plus one human Android verification session.

## Open Risks & Assumptions

- Browser local storage remains the local checkpoint medium; storage exceptions must fail safely but cannot guarantee durability when the platform refuses writes.
- Adding `@capacitor/app` may require native sync/version alignment with the existing Capacitor 8 project.
- Silent corrupt-data deletion is intentional and reduces diagnosability; automated tests become the primary regression evidence.
- The five-second interval is a maximum unsignaled progress-loss window, not a promise that Android delivers a final lifecycle callback.
- One pending result is sufficient because restart/play-again remains outside this change.

## Success Criteria (Summary)

- Cold recreation restores the same player's paused active match and deterministic continuation without creating a duplicate match.
- A completed result survives process recreation and is saved with the exact stable payload once, including across same-player reauthentication.
- Invalid credentials trigger one recovery flow without deleting progress; different-player verification and explicit logout delete prior local match state.
