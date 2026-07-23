# Clear Match Feedback Implementation Plan

## Overview

Implement S-02 as a focused gameplay readability pass over the implemented S-01 match. The player should be able to read the match at a glance from the frontline marker color and compact pressure label, understand which unit cards are buildable, building, ready, or sendable, and see what unit the NPC is currently preparing.

## Current State Analysis

S-01 is implemented and verified: `/play` hosts a Phaser match scene, the pure TypeScript engine owns match truth, Angular owns auth/result saving, and Android verification has already passed. The current feedback is functional but primitive. The scene shows raw pressure numbers, one active-build percentage, simple unit card state labels, and one-line messages, but it does not strongly connect pressure direction, unit readiness, or NPC activity to player-readable visual states.

## Desired End State

During a match, the player can understand the current pressure state from a frontline marker that turns blue, white, or red and a compact `Pressure <P> | Frontline <N>%` label. The battlefield uses the space reclaimed by removing boundary labels and separate pressure, build-status, and transient-message text. Unit cards keep the one-tap interaction from S-01, show build progress inside the existing bar below build time, and make `BUILD`, `BUILDING`, `READY`, `SEND`, and unavailable states visually distinct. The NPC's active build unit is visible, but its build progress is not shown. No engine behavior, result persistence, offline sync, restart flow, or backend contract changes are introduced.

### Key Discoveries:

- S-01 is marked implemented in `context/changes/s-01-first-saved-frontline-match/change.md:4`, so this plan treats S-01 source as the baseline rather than the older roadmap status.
- `MatchSnapshot` already exposes `pressure`, `playerPressure`, `npcPressure`, `playerActiveBuild`, `heldUnits`, and `npc` in `src/mbl/src/app/play/match-types.ts:42`, so S-02 can be scene-only.
- The Phaser scene already owns static layout, unit controls, tap handling, HUD rendering, and unit state rendering in `src/mbl/src/app/play/frontline-match.scene.ts:66`, `src/mbl/src/app/play/frontline-match.scene.ts:117`, `src/mbl/src/app/play/frontline-match.scene.ts:164`, `src/mbl/src/app/play/frontline-match.scene.ts:219`, and `src/mbl/src/app/play/frontline-match.scene.ts:233`.
- Current unit cards already use one tap target and status text in `src/mbl/src/app/play/frontline-match.scene.ts:149` and `src/mbl/src/app/play/frontline-match.scene.ts:249`.
- Phaser is lazy-loaded and lifecycle-managed through the Angular host in `src/mbl/src/app/play/phaser-game.component.ts:22`, `src/mbl/src/app/play/phaser-game.component.ts:73`, and `src/mbl/src/app/play/phaser-game.component.ts:93`.
- S-01 established that Phaser owns match canvas UI while Angular hosts the scene and calls the result API in `context/changes/s-01-first-saved-frontline-match/plan-brief.md:25`.
- S-01 explicitly deferred S-02 feedback work in `context/changes/s-01-first-saved-frontline-match/plan-brief.md:48`.

## What We're NOT Doing

- No new gameplay rules, balance changes, unit types, NPC strategy changes, or engine contract changes.
- No transient feedback events, activity log, message stack, or explicit engine event stream.
- No separate top pressure summary, boundary labels, active-build status line, or bottom transient-message line inside the match canvas.
- No new automated tests in this story; dedicated test coverage is deferred to a later story.
- No backend/API changes, result persistence changes, match history changes, or durable offline sync.
- No restart or play-again flow; S-04 owns restart after a completed match.
- No sound, asset-heavy effects, advanced animation polish, or production release work.

## Implementation Approach

Keep S-02 concentrated in the Phaser scene. Use the existing `MatchSnapshot` to derive visual state in `frontline-match.scene.ts`, preserving the S-01 engine boundary where Phaser renders snapshots and forwards commands but does not decide match truth. Favor stable primitive Phaser UI and fixed mobile portrait dimensions over asset-heavy polish. Angular and API code should remain unchanged unless a verification issue reveals a layout host problem.

## Critical Implementation Details

### User experience spec

Pressure state should be mostly visual: the frontline marker is blue when the player is pushing, white when holding, and red when under pressure. The nearby neutral label reads `Pressure <P> | Frontline <N>%`. The lane keeps its fixed red and blue territory fills; pressure does not tint the full battlefield.

### State sequencing

Do not add engine events for this slice. The scene should derive the display from the current snapshot only, with simple previous-snapshot comparison allowed only for non-authoritative visual state. Engine state, completion, and result saving remain unchanged.

## Phase 1: Pressure And Frontline Readability

### Overview

Make the lane/frontline communicate pressure direction and risk visually, without changing the engine's pressure calculation.

### Changes Required:

#### 1. Frontline pressure visual states

**File**: `src/mbl/src/app/play/frontline-match.scene.ts`

**Intent**: Pair a compact numeric label with a clear marker state for pushing, holding, or under pressure.

**Contract**: The scene derives pressure state from `snapshot.pressure`. Positive pressure maps the frontline marker to blue, zero pressure maps it to white, and negative pressure maps it to red. The nearby label reads `Pressure <P> | Frontline <N>%`, using `snapshot.pressure` and `snapshot.frontlinePosition`. Marker color remains the non-numeric pressure cue.

#### 2. Lane and marker clarity

**File**: `src/mbl/src/app/play/frontline-match.scene.ts`

**Intent**: Make the frontline position and pressure direction readable from the lane itself.

**Contract**: The lane retains fixed red and blue territory fills while only the frontline marker changes with pressure state. Remove the NPC boundary label, player boundary label, separate top pressure summary, active-build status line, and bottom transient-message line. Use the reclaimed vertical space to enlarge the battlefield within the existing 390x844 logical canvas without overlapping unit controls or the completion overlay.

### Success Criteria:

#### Automated Verification:

- Angular production build passes from `src/mbl`: `npm run build`
- No new engine contract is introduced in `src/mbl/src/app/play/match-types.ts`
- No new test files are added for S-02

#### Manual Verification:

- Browser viewport check shows blue when player pressure is positive, white when pressure is neutral or holding, and red when pressure is negative
- Frontline marker, enlarged lane, and `Pressure <P> | Frontline <N>%` label are readable at mobile portrait size
- Pressure clarity improves without relying only on raw numbers

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Build And Send State Clarity

### Overview

Refine the existing one-card-per-unit controls so their states are easy to distinguish during active play.

### Changes Required:

#### 1. Unit card state language

**File**: `src/mbl/src/app/play/frontline-match.scene.ts`

**Intent**: Keep the one-tap S-01 interaction while making each card's state obvious.

**Contract**: Each unit card visibly distinguishes idle/buildable, currently building, completed/ready, sendable, and temporarily unavailable states. While one unit is building, other cards must not misleadingly appear buildable or silently accept a rejected build attempt. `BUILD`, `BUILDING`, `READY`, and `SEND` states may be represented by text plus color/shape treatment, but the tap target remains the existing card-level interaction.

#### 2. Build progress readability

**File**: `src/mbl/src/app/play/frontline-match.scene.ts`

**Intent**: Improve active build progress so the player can read what is being built and how far along it is without hunting across the HUD and cards.

**Contract**: The active build state remains driven by `snapshot.playerActiveBuild.progress`. Display the active percentage inside the existing progress bar below the unit build time. The bar keeps stable dimensions and does not shift card layout as percentages change. Do not restore a separate `No active build` / `Building <U> <N>%` status line or bottom build/send message line.

### Success Criteria:

#### Automated Verification:

- Angular production build passes from `src/mbl`: `npm run build`
- No separate build/send controls are introduced
- No auto-send behavior is introduced

#### Manual Verification:

- A player can tell which card can start a build, which one is building, which cards are temporarily unavailable, and which completed unit can be sent
- Unit cards remain tappable and aligned in browser and mobile portrait layout
- Building and sending behavior remains the same as S-01

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: NPC Active Build Visibility

### Overview

Show what the NPC is currently building so incoming pressure is understandable, while preserving some uncertainty by not showing NPC build progress.

### Changes Required:

#### 1. NPC active build display

**File**: `src/mbl/src/app/play/frontline-match.scene.ts`

**Intent**: Add a compact in-canvas indicator for the NPC's currently active build.

**Contract**: The display reads `snapshot.npc.activeBuild?.unitType` and maps it to the existing unit label. It shows the active NPC unit when present and a neutral waiting/idle state when absent. It does not expose NPC build progress percentage, elapsed time, or exact time remaining.

#### 2. HUD layout protection

**File**: `src/mbl/src/app/play/frontline-match.scene.ts`

**Intent**: Fit NPC build visibility into the existing mobile canvas without crowding pressure, frontline, or player build controls.

**Contract**: The NPC indicator remains inside the Phaser scene, uses primitive text/shape treatment consistent with the rest of S-02, and does not move result saving status into the canvas.

### Success Criteria:

#### Automated Verification:

- Angular production build passes from `src/mbl`: `npm run build`
- No NPC strategy or cadence changes are introduced in `src/mbl/src/app/play/match-engine.ts`
- No NPC progress value is displayed to the player

#### Manual Verification:

- Browser check shows the NPC active unit when the NPC is building
- Browser check shows a neutral NPC idle/waiting state when no NPC build is active
- Android check confirms the NPC indicator remains readable and does not overlap other match UI

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Manual Verification And Handoff

### Overview

Verify S-02 as a readability slice in browser and Android, then update the change folder with the manual verification record.

### Changes Required:

#### 1. S-02 verification record

**File**: `context/changes/s-02-clear-match-feedback/manual-verification.md`

**Intent**: Record the browser and Android checks used to confirm the feedback improvements.

**Contract**: Document the date, verifier, commands run, browser viewport used, Android device/emulator details when available, and observations for pressure color states, unit card states, NPC active build visibility, and no behavior regressions.

#### 2. Change metadata

**File**: `context/changes/s-02-clear-match-feedback/change.md`

**Intent**: Keep change metadata aligned with planning and later implementation state.

**Contract**: Planning sets status to `planned`; implementation may later update status through the normal 10x workflow.

### Success Criteria:

#### Automated Verification:

- Angular production build passes from `src/mbl`: `npm run build`
- Existing Angular test suite passes from `src/mbl` if run as a regression check: `npm test`
- Capacitor sync completes from `src/mbl` before Android verification: `npx cap sync android`

#### Manual Verification:

- Browser manual check confirms pushing/holding/under-pressure states use blue/white/red visual treatment
- Browser manual check confirms unit cards clearly distinguish buildable, building, ready, and sendable states
- Browser manual check confirms NPC active build unit is visible without showing progress
- Android emulator/device check confirms portrait readability and touch alignment
- `manual-verification.md` records the manual browser and Android check

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- No new unit tests are added in S-02. Dedicated automated coverage for these visual state mappings is deferred to a later story by product decision.

### Integration Tests:

- No new integration tests are added in S-02. Existing Angular tests may be run as regression checks, but this story should not introduce test files.

### Manual Testing Steps:

1. Start the Angular app and sign in through the existing flow.
2. Open `/play` in a mobile-sized browser viewport.
3. Build and send enough player units to create positive pressure; confirm the frontline marker turns blue.
4. Let pressure return to zero; confirm the frontline marker turns white.
5. Let NPC pressure exceed player pressure; confirm the frontline marker turns red.
6. Confirm the nearby label reads `Pressure <P> | Frontline <N>%` and no removed boundary, pressure-summary, active-build, or transient-message text returns.
7. Confirm unit cards distinguish buildable, building, unavailable, ready, and sendable states while preserving one-tap interaction, with active progress shown inside the bar below build time.
8. Wait for an NPC build to start and confirm the NPC active unit is visible without progress.
9. Build the Angular app, sync Capacitor, and repeat the readability/touch checks on Android emulator or device.

## Performance Considerations

Keep the pass primitive and scene-local. Avoid new bitmap assets, large dependencies, root Phaser imports, or continuous heavy object churn. The production initial bundle was already kept within budget by S-01 through Phaser isolation; S-02 should preserve that shape.

## Migration Notes

No backend schema migration, API migration, auth migration, or data migration is expected. No EF migrations are needed.

## References

- Product requirements: `context/foundation/prd.md`
- Roadmap S-02: `context/foundation/roadmap.md`
- S-01 plan brief: `context/changes/s-01-first-saved-frontline-match/plan-brief.md`
- S-01 implementation plan: `context/changes/s-01-first-saved-frontline-match/plan.md`
- Existing match snapshot contract: `src/mbl/src/app/play/match-types.ts:42`
- Existing Phaser scene: `src/mbl/src/app/play/frontline-match.scene.ts:66`
- Existing unit tap handling: `src/mbl/src/app/play/frontline-match.scene.ts:164`
- Existing HUD rendering: `src/mbl/src/app/play/frontline-match.scene.ts:219`
- Existing unit control rendering: `src/mbl/src/app/play/frontline-match.scene.ts:233`
- Existing Phaser Angular host: `src/mbl/src/app/play/phaser-game.component.ts:22`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` - <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Pressure And Frontline Readability

#### Automated

- [x] 1.1 Angular production build passes from `src/mbl`: `npm run build` — e8d6909
- [x] 1.2 No new engine contract is introduced in `src/mbl/src/app/play/match-types.ts` — e8d6909
- [x] 1.3 No new test files are added for S-02 — e8d6909

#### Manual

- [x] 1.4 Browser viewport check shows blue when player pressure is positive, white when pressure is neutral or holding, and red when pressure is negative — e8d6909
- [x] 1.5 Frontline marker, lane, and labels are readable at mobile portrait size — e8d6909
- [x] 1.6 Pressure clarity improves without relying only on raw numbers — e8d6909

### Phase 2: Build And Send State Clarity

#### Automated

- [x] 2.1 Angular production build passes from `src/mbl`: `npm run build` — 0522c9c
- [x] 2.2 No separate build/send controls are introduced — 0522c9c
- [x] 2.3 No auto-send behavior is introduced — 0522c9c

#### Manual

- [x] 2.4 A player can tell which card can start a build, which one is building, and which completed unit can be sent — 0522c9c
- [x] 2.5 Unit cards remain tappable and aligned in browser and mobile portrait layout — 0522c9c
- [x] 2.6 Building and sending behavior remains the same as S-01 — 0522c9c

### Phase 3: NPC Active Build Visibility

#### Automated

- [x] 3.1 Angular production build passes from `src/mbl`: `npm run build`
- [x] 3.2 No NPC strategy or cadence changes are introduced in `src/mbl/src/app/play/match-engine.ts`
- [x] 3.3 No NPC progress value is displayed to the player

#### Manual

- [x] 3.4 Browser check shows the NPC active unit when the NPC is building
- [x] 3.5 Browser check shows a neutral NPC idle/waiting state when no NPC build is active
- [x] 3.6 Android check confirms the NPC indicator remains readable and does not overlap other match UI

### Phase 4: Manual Verification And Handoff

#### Automated

- [ ] 4.1 Angular production build passes from `src/mbl`: `npm run build`
- [ ] 4.2 Existing Angular test suite passes from `src/mbl` if run as a regression check: `npm test`
- [ ] 4.3 Capacitor sync completes from `src/mbl` before Android verification: `npx cap sync android`

#### Manual

- [ ] 4.4 Browser manual check confirms pushing/holding/under-pressure states use blue/white/red visual treatment
- [ ] 4.5 Browser manual check confirms unit cards clearly distinguish buildable, building, ready, and sendable states
- [ ] 4.6 Browser manual check confirms NPC active build unit is visible without showing progress
- [ ] 4.7 Android emulator/device check confirms portrait readability and touch alignment
- [ ] 4.8 `manual-verification.md` records the manual browser and Android check
