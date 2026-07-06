# First Saved Frontline Match Implementation Plan

## Overview

Implement S-01 as the first playable Android mobile game slice. A signed-in player reaches `/play`, plays a touch-first Phaser frontline match inside the Angular app, wins or loses against an automated pressure-reactive NPC, and submits the completed result to the existing authenticated `POST /api/results` endpoint. This plan also initializes Capacitor Android so the UI can be manually verified on an Android device or emulator before later polish slices build on it.

## Current State Analysis

F-01 is complete enough for S-01 to consume: Angular auth routes, guarded `/play`, JWT request interception, and `ResultsApiClient.saveCompletedResult()` already exist. `/play` currently renders a protected smoke-test placeholder rather than gameplay. Phaser is already installed and locked in the Angular package set, but no app source imports Phaser and no game feature exists yet. Capacitor is named by the stack as the Android packaging path, but this repository currently has no Capacitor config or Android platform project.

## Desired End State

The player can sign in, open `/play`, and play a mobile portrait match using three unit types. The player can build one unit at a time, hold one completed unit per type, send held units, and see the frontline move from strength-driven pressure until Victory or Defeat. Angular submits the completed result with one stable `clientMatchId` to `POST /api/results`; if the API request fails, the result screen offers an in-memory retry for the same payload. The Angular app can be built, synced into Capacitor, and manually checked on Android for alignment and touch behavior.

### Key Discoveries:

- `/play` is already protected and currently points to `ProtectedPlaceholderComponent` in `src/mbl/src/app/app.routes.ts:18`.
- The placeholder already proves authenticated result submission through `ResultsApiClient.saveCompletedResult()` in `src/mbl/src/app/protected/protected-placeholder.component.ts:36`.
- The result client contract already matches the API payload: `clientMatchId`, `outcome`, `durationSeconds`, `completedAt`, `finalScore`, and `finalFrontlinePosition` in `src/mbl/src/app/core/api/results-api.client.ts:9`.
- The API save endpoint is authenticated at `src/api/Controllers/ResultsController.cs:11` and routes through `api/results` at `src/api/Controllers/ResultsController.cs:12`.
- API validation accepts only `Victory` or `Defeat`, duration `1..86400`, score `-10000..10000`, and frontline position `0..100` in `src/api/Results/MatchResultService.cs:73`.
- Result idempotency requires retrying the exact same payload for the same `clientMatchId`; different payloads conflict in `src/api/Results/MatchResultSaveResult.cs:39`.
- Phaser is already present in `src/mbl/package.json:20` and locked to `3.90.0` in `src/mbl/package-lock.json:6394`; the older research note saying it was absent is stale.
- Angular production initial bundle budget errors above `1MB` in `src/mbl/angular.json:64`, so the match feature should avoid eager root imports where practical.
- Angular tests use the unit-test builder with Vitest in `src/mbl/angular.json:95`.
- The stack source says Angular is the shell, Phaser supplies the game loop, and Capacitor packages Android in `context/foundation/tech-stack.md:29`.

## What We're NOT Doing

- No real-time multiplayer, social features, leaderboard, campaign, progression, economy, upgrades, inventory, monetization, ads, push notifications, or iOS support.
- No backend-authoritative simulation, pathfinding, physics combat, replay validation, or complex AI.
- No durable offline pending-result queue; S-03 owns resilient result sync.
- No restart or play-again loop; S-04 owns restart after completed match.
- No S-02-level polish, advanced animation, soundtrack, advanced sound design, or rich feedback pass.
- No production release signing, Google Play Console setup, `.aab` release build, or production API endpoint finalization.

## Implementation Approach

Start by adding the Android packaging foundation because S-01 now needs early device/emulator verification. Then implement the game rules in pure TypeScript before touching Phaser, so the per-type held-unit slots and pressure-reactive NPC are deterministic and testable without canvas. Use Phaser for the complete in-match mobile UI: frontline, build controls, held/send indicators, progress, outcome overlay, and save/retry state. Keep persistence in the API: the Phaser scene emits a completed summary, the Angular host submits it through `ResultsApiClient`, and retry reuses the same payload and `clientMatchId`.

## Critical Implementation Details

### Timing & lifecycle

Create exactly one `Phaser.Game` per mounted Angular host and destroy it on component teardown. After route-driven layout changes or first visibility, update Phaser scale bounds so touch coordinates line up with the Android WebView.

### User experience spec

S-01 is mobile portrait first. Use a fixed logical portrait game size with Phaser `FIT` scaling, touch/pointer input, stable button dimensions, and primitive but readable controls. The UI should be functional on Android before it is polished.

### State sequencing

The engine owns match truth. Phaser renders snapshots and forwards commands; tweens and visual effects must not decide completion. When completion fires, freeze simulation, emit one completed payload, save it through Angular, and retry only that exact payload if the save fails.

## Phase 1: Capacitor Android Foundation

### Overview

Initialize Capacitor for the Angular app and add the Android platform so S-01 can be manually checked on an Android device or emulator.

### Changes Required:

#### 1. Capacitor package dependencies

**File**: `src/mbl/package.json`

**Intent**: Add Capacitor runtime, CLI, and Android platform dependencies needed to package the Angular app as an Android application.

**Contract**: Dependencies include `@capacitor/core`, `@capacitor/cli`, and `@capacitor/android` using current compatible Capacitor versions. `package-lock.json` is updated through npm, not edited manually.

#### 2. Capacitor application config

**File**: `src/mbl/capacitor.config.ts`

**Intent**: Define the Android app identity and point Capacitor at the Angular production build output.

**Contract**: Config sets a stable app id, app name, and `webDir` matching Angular's output folder containing `index.html` after `npm run build`.

#### 3. Android platform project

**File**: `src/mbl/android/**`

**Intent**: Add the generated Capacitor Android platform project for local device/emulator verification.

**Contract**: The Android project is generated by Capacitor commands and kept aligned through `npx cap sync android`; generated Gradle/project files are committed only if they are source inputs required to reproduce Android builds.

#### 4. Local Android commands

**File**: `README.md`

**Intent**: Document the local S-01 Android verification path without introducing production release instructions.

**Contract**: Add commands for Angular build, Capacitor sync, and local Android run/open. Keep production signing, Play Console, and `.aab` release work out of S-01.

### Success Criteria:

#### Automated Verification:

- Angular production build passes from `src/mbl`: `npm run build`
- Capacitor sync completes from `src/mbl`: `npx cap sync android`
- Android project is present after generation: `src/mbl/android`

#### Manual Verification:

- Developer can open or run the Android project locally with Capacitor tooling
- Capacitor config points to the actual Angular build output and not a stale folder
- No production signing secrets or Play Console configuration are introduced

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Mobile Match Engine Contract

### Overview

Build the deterministic rules layer for the first playable match before integrating Phaser.

### Changes Required:

#### 1. Match shared types

**File**: `src/mbl/src/app/play/match-types.ts`

**Intent**: Define the engine-facing contracts for units, player commands, NPC decisions, state snapshots, completion summaries, and save payload conversion.

**Contract**: Types include three unit identifiers, `Victory | Defeat`, match snapshot, held-unit slots keyed by unit type, active build state, NPC state, and a completed summary compatible with `CompletedResultRequest`.

#### 2. Match balance config

**File**: `src/mbl/src/app/play/match-config.ts`

**Intent**: Centralize S-01 tuned constants so balance is visible and testable.

**Contract**: Config defines three unit types with fixed strength/build times, pressure-to-frontline speed, boundaries, NPC cadence, pressure-reactive choice thresholds, and a target match duration around two minutes.

#### 3. Deterministic match engine

**File**: `src/mbl/src/app/play/match-engine.ts`

**Intent**: Own all match truth: build progress, one active player build, one held completed unit per unit type, send commands, NPC automated build/send behavior, pressure, frontline movement, and completion.

**Contract**: The engine exposes commands for starting a build, sending a held unit, stepping elapsed time, reading a snapshot, and reading completion. It accepts a seedable random source or deterministic decision hook so pressure-reactive NPC behavior can be tested.

#### 4. Result payload creation

**File**: `src/mbl/src/app/play/match-result-mapper.ts`

**Intent**: Convert an engine completion into the existing result API payload.

**Contract**: Mapper creates one stable `clientMatchId` per match, sets `outcome` to `Victory` or `Defeat`, clamps or derives `finalFrontlinePosition` within `0..100`, preserves final score inside API bounds, and reuses the exact same payload for retry.

#### 5. Engine specs

**File**: `src/mbl/src/app/play/match-engine.spec.ts`

**Intent**: Cover the stateful rules that later Phaser UI depends on.

**Contract**: Specs cover unit build progress, active-build restrictions, per-type held slots, sending held units, blocked duplicate held unit by type, pressure-reactive NPC choices, frontline movement, Victory/Defeat boundaries, and result payload stability.

### Success Criteria:

#### Automated Verification:

- Match engine specs pass from `src/mbl`: `npm test -- --include src/app/play/match-engine.spec.ts`
- Full Angular tests pass from `src/mbl`: `npm test`
- Type checking/build passes from `src/mbl`: `npm run build`

#### Manual Verification:

- Unit strengths/build times/NPC cadence are understandable from one config file
- Engine behavior matches the selected S-01 gameplay decisions: winnable with pressure, per-type held slots, pressure-reactive NPC

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Touch-First Phaser Match Surface

### Overview

Render the playable match in Phaser with primitive mobile UI and keep Phaser focused on input, rendering, and loop timing.

### Changes Required:

#### 1. Phaser game host component

**File**: `src/mbl/src/app/play/phaser-game.component.ts`

**Intent**: Create and destroy the Phaser game instance inside Angular and provide a typed completion callback to the play page.

**Contract**: Component creates one game instance for its host element, destroys it on teardown, uses a fixed portrait game size with `FIT` scaling, and calls the parent with exactly one completed match summary per match.

#### 2. Phaser host template and styles

**File**: `src/mbl/src/app/play/phaser-game.component.html`

**Intent**: Provide a stable DOM parent for the Phaser canvas.

**Contract**: Template contains a stable host element for Phaser and no duplicate gameplay controls outside the canvas.

**File**: `src/mbl/src/app/play/phaser-game.component.scss`

**Intent**: Size the game host for mobile portrait layout and Android WebView checks.

**Contract**: Styles keep the host stable across mobile widths and avoid layout shifts that would desynchronize input coordinates.

#### 3. Frontline match scene

**File**: `src/mbl/src/app/play/frontline-match.scene.ts`

**Intent**: Draw the lane/frontline, unit build buttons, progress state, held/send indicators, NPC pressure, and result overlay using Phaser primitives.

**Contract**: Scene calls the pure engine on `update`, uses `pointerdown` input for mobile/touch actions, renders primitive rectangles/graphics/text, freezes on completion, and does not call the result API.

#### 4. Phaser game config factory

**File**: `src/mbl/src/app/play/frontline-game.config.ts`

**Intent**: Keep Phaser setup isolated from the rest of Angular.

**Contract**: Config uses Phaser 3 APIs, fixed portrait dimensions, `Phaser.Scale.FIT`, centered canvas behavior, and the S-01 scene. It avoids Phaser imports from app root code.

#### 5. Scene smoke spec

**File**: `src/mbl/src/app/play/phaser-game.component.spec.ts`

**Intent**: Verify Angular host behavior without attempting broad canvas/WebGL testing.

**Contract**: Spec verifies the host can receive a mocked completion and emit it upward; full visual behavior remains manual Android verification.

### Success Criteria:

#### Automated Verification:

- Angular tests pass from `src/mbl`: `npm test`
- Angular production build passes from `src/mbl`: `npm run build`
- Production build stays within configured budgets

#### Manual Verification:

- Phaser match appears in a mobile portrait layout with no blank canvas
- Touching unit controls starts builds and sends held units
- Frontline movement, build progress, held slots, and win/loss overlay are visible enough for S-01
- Visual polish remains primitive and does not pull in S-02 scope

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Protected Play and Result Save Integration

### Overview

Replace the smoke-test placeholder with the actual match page and submit completed results through the existing authenticated API client to `POST /api/results`.

### Changes Required:

#### 1. Play route update

**File**: `src/mbl/src/app/app.routes.ts`

**Intent**: Route the protected `/play` path to the real play page while preserving auth behavior.

**Contract**: `/play` remains guarded by `authGuard`; empty and wildcard routes continue to land on the protected play flow.

#### 2. Play page component

**File**: `src/mbl/src/app/play/play-page.component.ts`

**Intent**: Own Angular-side auth chrome, logout, completed-result save state, and retry behavior while Phaser owns gameplay UI.

**Contract**: Component receives one completed summary from the Phaser host, maps it to `CompletedResultRequest`, calls `ResultsApiClient.saveCompletedResult()`, tracks saving/saved/failed state, and retries the exact same payload on failure.

#### 3. Play page template and styles

**File**: `src/mbl/src/app/play/play-page.component.html`

**Intent**: Host the Phaser game and minimal mobile app chrome.

**Contract**: Template includes the Phaser host, account/logout affordance, and any non-game save status needed by Angular without duplicating in-canvas controls.

**File**: `src/mbl/src/app/play/play-page.component.scss`

**Intent**: Keep the mobile layout aligned for Android WebView and avoid nested card-heavy structure around the game surface.

**Contract**: Styles support mobile portrait first, stable game host sizing, and readable auth/logout chrome without crowding the canvas.

#### 4. Placeholder retirement

**File**: `src/mbl/src/app/protected/protected-placeholder.component.ts`

**Intent**: Remove or stop routing to the F-01 smoke-test placeholder so S-01 is the protected play surface.

**Contract**: No user-facing `/play` path exposes the hardcoded smoke result action after S-01.

**File**: `src/mbl/src/app/protected/protected-placeholder.component.html`

**Intent**: Remove obsolete smoke-test UI if the component is deleted or no longer referenced.

**Contract**: No stale "Save test result" UI remains in the protected play flow.

**File**: `src/mbl/src/app/protected/protected-placeholder.component.scss`

**Intent**: Remove obsolete placeholder styling if the component is deleted or no longer referenced.

**Contract**: No unused protected placeholder styles remain if the component is removed.

#### 5. Play integration specs

**File**: `src/mbl/src/app/play/play-page.component.spec.ts`

**Intent**: Verify Angular integration around completion, saving, failure, and retry.

**Contract**: Specs mock `ResultsApiClient`, assert one save on completion, assert no duplicate save while saving, assert retry reuses the same payload and `clientMatchId`, and assert logout remains available.

### Success Criteria:

#### Automated Verification:

- Play page specs pass from `src/mbl`: `npm test -- --include src/app/play/play-page.component.spec.ts`
- Full Angular tests pass from `src/mbl`: `npm test`
- Angular production build passes from `src/mbl`: `npm run build`

#### Manual Verification:

- Signed-in user lands on the real match at `/play`
- Anonymous user still redirects to sign-in and returns to `/play` after verification
- Completed Victory or Defeat attempts to save once
- Failed save shows a retry path that resends the same completed result

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Android Manual Verification and Handoff

### Overview

Verify the completed S-01 slice in the Angular build and through Capacitor Android, then update documentation and change metadata for implementation handoff.

### Changes Required:

#### 1. README S-01 verification notes

**File**: `README.md`

**Intent**: Record local verification commands for the first match slice.

**Contract**: Notes include Angular test/build, Capacitor sync/run/open, and local API/auth prerequisites. They do not claim production release readiness.

#### 2. Change metadata

**File**: `context/changes/s-01-first-saved-frontline-match/change.md`

**Intent**: Keep the change status and update date aligned with planning and implementation progress.

**Contract**: Status remains `planned` after planning; implementers update status/progress through later implementation workflow.

#### 3. Capacitor verification record

**File**: `context/changes/s-01-first-saved-frontline-match/android-verification.md`

**Intent**: Capture the device/emulator and alignment checks used for the S-01 manual gate.

**Contract**: Document device/emulator name, Android version if known, commands run, UI alignment observations, touch-target observations, result-save outcome, and any follow-up issues.

### Success Criteria:

#### Automated Verification:

- Angular tests pass from `src/mbl`: `npm test`
- Angular production build passes from `src/mbl`: `npm run build`
- Capacitor sync completes from `src/mbl`: `npx cap sync android`
- API builds from repo root: `dotnet build src/api/frontLineApi.slnx`
- API tests pass from repo root: `dotnet test src/api/frontLineApi.slnx`

#### Manual Verification:

- Android device/emulator shows the match in portrait with aligned canvas and controls
- Touch input lands on the intended build/send controls
- A full match can end in Victory or Defeat and show the frozen result overlay
- API save success is visible when the local API is reachable
- API save failure and retry can be verified by stopping or blocking the local API during a completed result
- `android-verification.md` records the manual Android check

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Match engine build timing, active build restrictions, held slots by unit type, send commands, pressure calculation, NPC decision behavior, win/loss boundaries, and payload stability.
- Result mapper output matches the existing `CompletedResultRequest` contract and keeps retry payloads stable.
- Play page invokes the result client once per completion and retries the same payload after failure.
- Route integration keeps `/play` protected.

### Integration Tests:

- Angular host-level integration with mocked Phaser completion and mocked `ResultsApiClient`.
- Existing API result tests remain the backend contract guard; S-01 should not add backend simulation tests.

### Manual Testing Steps:

1. Start the API locally and sign in through the existing passwordless flow.
2. Start the Angular app locally and confirm `/play` renders the Phaser match.
3. Build each unit type, verify one active build at a time, and verify one held unit per type.
4. Send held units and confirm frontline pressure changes.
5. Play until Victory, verify the result overlay and saved state.
6. Play or tune a path to Defeat, verify the result overlay and saved state.
7. Stop the API before completion, verify save failure, restore the API, and retry the same result.
8. Run `npm run build`, `npx cap sync android`, then run/open Android and repeat alignment and touch checks on device/emulator.

## Performance Considerations

Keep Phaser isolated from root app imports where practical because the Angular production initial bundle budget errors above 1 MB. The match engine should use simple arithmetic and small immutable or snapshot-friendly state. Avoid asset-heavy rendering in S-01; primitives are sufficient and reduce Android WebView startup risk.

## Migration Notes

No backend schema migration is expected. Capacitor initialization adds a generated Android project and config, but does not create production release signing, Play Store metadata, or deployment migration work.

## References

- Related research: `context/changes/s-01-first-saved-frontline-match/research.md`
- Phaser API notes: `context/changes/phaser-api-docs.md`
- Product requirements: `context/foundation/prd.md`
- Roadmap S-01: `context/foundation/roadmap.md`
- Stack decision: `context/foundation/tech-stack.md`
- Existing `/play` route: `src/mbl/src/app/app.routes.ts:18`
- Existing result client: `src/mbl/src/app/core/api/results-api.client.ts:32`
- Existing API result endpoint: `src/api/Controllers/ResultsController.cs:12`
- Capacitor getting started: `https://capacitorjs.com/docs/getting-started`
- Capacitor Android docs: `https://capacitorjs.com/docs/android`
- Capacitor Angular guide: `https://capacitorjs.com/docs/guides/angular`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` - <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Capacitor Android Foundation

#### Automated

- [x] 1.1 Angular production build passes from `src/mbl`: `npm run build` — b6e075e
- [x] 1.2 Capacitor sync completes from `src/mbl`: `npx cap sync android` — b6e075e
- [x] 1.3 Android project is present after generation: `src/mbl/android` — b6e075e

#### Manual

- [x] 1.4 Developer can open or run the Android project locally with Capacitor tooling — b6e075e
- [x] 1.5 Capacitor config points to the actual Angular build output and not a stale folder — b6e075e
- [x] 1.6 No production signing secrets or Play Console configuration are introduced — b6e075e

### Phase 2: Mobile Match Engine Contract

#### Automated

- [ ] 2.1 Match engine specs pass from `src/mbl`: `npm test -- --include src/app/play/match-engine.spec.ts`
- [ ] 2.2 Full Angular tests pass from `src/mbl`: `npm test`
- [ ] 2.3 Type checking/build passes from `src/mbl`: `npm run build`

#### Manual

- [ ] 2.4 Unit strengths/build times/NPC cadence are understandable from one config file
- [ ] 2.5 Engine behavior matches the selected S-01 gameplay decisions: winnable with pressure, per-type held slots, pressure-reactive NPC

### Phase 3: Touch-First Phaser Match Surface

#### Automated

- [ ] 3.1 Angular tests pass from `src/mbl`: `npm test`
- [ ] 3.2 Angular production build passes from `src/mbl`: `npm run build`
- [ ] 3.3 Production build stays within configured budgets

#### Manual

- [ ] 3.4 Phaser match appears in a mobile portrait layout with no blank canvas
- [ ] 3.5 Touching unit controls starts builds and sends held units
- [ ] 3.6 Frontline movement, build progress, held slots, and win/loss overlay are visible enough for S-01
- [ ] 3.7 Visual polish remains primitive and does not pull in S-02 scope

### Phase 4: Protected Play and Result Save Integration

#### Automated

- [ ] 4.1 Play page specs pass from `src/mbl`: `npm test -- --include src/app/play/play-page.component.spec.ts`
- [ ] 4.2 Full Angular tests pass from `src/mbl`: `npm test`
- [ ] 4.3 Angular production build passes from `src/mbl`: `npm run build`

#### Manual

- [ ] 4.4 Signed-in user lands on the real match at `/play`
- [ ] 4.5 Anonymous user still redirects to sign-in and returns to `/play` after verification
- [ ] 4.6 Completed Victory or Defeat attempts to save once
- [ ] 4.7 Failed save shows a retry path that resends the same completed result

### Phase 5: Android Manual Verification and Handoff

#### Automated

- [ ] 5.1 Angular tests pass from `src/mbl`: `npm test`
- [ ] 5.2 Angular production build passes from `src/mbl`: `npm run build`
- [ ] 5.3 Capacitor sync completes from `src/mbl`: `npx cap sync android`
- [ ] 5.4 API builds from repo root: `dotnet build src/api/frontLineApi.slnx`
- [ ] 5.5 API tests pass from repo root: `dotnet test src/api/frontLineApi.slnx`

#### Manual

- [ ] 5.6 Android device/emulator shows the match in portrait with aligned canvas and controls
- [ ] 5.7 Touch input lands on the intended build/send controls
- [ ] 5.8 A full match can end in Victory or Defeat and show the frozen result overlay
- [ ] 5.9 API save success is visible when the local API is reachable
- [ ] 5.10 API save failure and retry can be verified by stopping or blocking the local API during a completed result
- [ ] 5.11 `android-verification.md` records the manual Android check
