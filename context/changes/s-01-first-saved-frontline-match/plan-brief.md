# First Saved Frontline Match - Plan Brief

> Full plan: `context/changes/s-01-first-saved-frontline-match/plan.md`
> Research: `context/changes/s-01-first-saved-frontline-match/research.md`

## What & Why

Build the first playable Front Line Android mobile slice: a signed-in player plays a touch-first Phaser match inside Angular, reaches Victory or Defeat, and submits the completed result to `POST /api/results`. This proves the product's core push-and-pull frontline loop while initializing Capacitor early enough to catch Android alignment and touch issues.

## Starting Point

Auth, guarded `/play`, JWT API requests, and the completed-result save client already exist from F-01. `/play` still shows a smoke-test placeholder, Phaser is installed but unused, and Capacitor/Android have not been initialized.

## Desired End State

`/play` is the real mobile match screen. The player chooses among three unit types, builds one unit at a time, can hold one completed unit per type, sends units manually, fights a pressure-reactive NPC, and sees a frozen result overlay. Angular submits the same completed payload to `POST /api/results` or retries that request after failure; the API owns persistence. The app can be synced/run through Capacitor Android for manual UI checks.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Product target | Android mobile game | PRD and stack define a mobile Android game, not a web game. | Research / Plan |
| Capacitor scope | Include initialization in S-01 | Early Android verification can catch alignment/touch issues before polish. | Plan |
| Match balance | Simple tuned constants | Fast, visible, testable first balance pass. | Plan |
| UI ownership | Phaser owns match canvas UI | Keeps gameplay cohesive; Angular hosts the scene and calls the result API. | Research / Plan |
| Save failure | In-memory retry with same payload | Preserves idempotency without implementing S-03 durable sync. | Research / Plan |
| Testing depth | Engine-heavy plus Angular host tests | Covers rules and save behavior without fragile canvas tests. | Plan |
| Difficulty | Winnable with pressure | Proves tactical tension while letting testers reach save flow. | Plan |
| Held units | One held unit per unit type | Supports richer tactical timing than a single held slot. | Plan |
| NPC behavior | Pressure-reactive choices | Feels automated without backend simulation or complex AI. | Plan |
| Scope guardrail | Engine-first complexity, primitive UI | Keeps richer rules while deferring polish to S-02. | Plan |

## Scope

**In scope:**

- Capacitor packages, config, Android platform, and local Android verification commands
- Pure TypeScript match engine and tests
- Touch-first Phaser match scene with primitive mobile UI
- Protected `/play` replacement
- API save success, API save failure, and retry for the same completed result request
- Android device/emulator alignment and touch verification record

**Out of scope:**

- Offline durable result sync
- Restart/play-again loop
- Polished animations, sound, advanced effects, or S-02 feedback work
- Backend-authoritative simulation or complex AI
- Production signing, Google Play release, `.aab` release build, iOS support

## Architecture / Approach

Angular remains the app shell for auth, routing, logout, and API calls. Phaser runs one mobile portrait match scene inside an Angular host and renders all in-match controls. A pure TypeScript engine owns game state and emits a completed summary; Angular maps that summary to the existing result API payload and submits it to `POST /api/results`. The API owns persistence, while Angular owns request state and retry. Capacitor packages the Angular build into Android for local verification.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Capacitor Android Foundation | Android platform and sync path exist | Generated Android setup can expose build/tooling assumptions |
| 2. Mobile Match Engine Contract | Tested rules for match, NPC, held slots, result payload | Per-type held slots and reactive NPC add state complexity |
| 3. Touch-First Phaser Match Surface | Playable primitive mobile match UI | Canvas/input alignment on Android WebView |
| 4. Protected Play and Result Save Integration | `/play` submits completed results to `POST /api/results` with retry | Duplicate API submissions or changed retry payloads |
| 5. Android Manual Verification and Handoff | Device/emulator verification and docs | Manual Android setup may vary by machine |

**Prerequisites:** F-01 auth/result foundation is present; local Node/npm and Android development tooling are available for Capacitor verification.
**Estimated effort:** ~4-6 implementation sessions across 5 phases.

## Open Risks & Assumptions

- Capacitor initialization requires local Android SDK/Studio tooling that may not be fully configured on every machine.
- The first balance constants are intentionally rough and may require later tuning.
- The Android production API URL is not solved here; S-01 verifies local behavior only.
- Durable offline save protection remains S-03, so S-01 retry is memory-only.

## Success Criteria (Summary)

- A signed-in player can complete a Victory or Defeat match through `/play`.
- The completed result is persisted by `POST /api/results`, and failed client submissions can retry the same payload.
- The match UI is manually verified through Capacitor Android for portrait layout and touch alignment.
