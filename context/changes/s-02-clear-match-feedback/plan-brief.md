# Clear Match Feedback - Plan Brief

> Full plan: `context/changes/s-02-clear-match-feedback/plan.md`

## What & Why

S-02 improves the readability of the existing S-01 match during play. The goal is not new rules or polish for its own sake; it is making build state, send readiness, NPC activity, and frontline pressure obvious in a short mobile strategy session.

## Starting Point

S-01 already provides a protected `/play` route, a Phaser match scene, a pure TypeScript engine, result saving, and Android verification. The current UI is functional but primitive: raw pressure text, basic unit card labels, and no visible NPC active build indicator.

## Desired End State

The player can read the match at a glance. Blue means pushing, white means holding, and red means under pressure. Unit cards still use one tap target but clearly distinguish buildable, building, ready, and sendable states. The NPC's active build unit is shown, but its progress is not.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Primary goal | Readability during play | This directly matches S-02 and the PRD guardrail that frontline movement must be clear. |
| Send UX | Keep one tap target per unit | Preserves S-01 touch behavior and avoids crowding the 390x844 canvas. |
| Pressure signal | Mostly visual blue/white/red states | Makes pushing, holding, and under-pressure states readable without relying on numbers. |
| NPC feedback | Show active NPC unit, not progress | Incoming pressure becomes legible without exposing exact NPC timing. |
| Engine scope | No engine changes | Existing snapshots expose enough state for a scene-only clarity pass. |
| Feedback events | No transient event system | Avoids turning S-02 into an activity-log or animation-events story. |
| Test scope | No new tests in this story | Automated coverage for visual mappings is deferred to a later story by product decision. |
| Verification | Browser plus Android | Browser keeps iteration fast; Android confirms the target mobile readability and touch surface. |

## Scope

**In scope:**

- Phaser scene pressure state visuals
- Clearer unit card state treatment
- NPC active build unit display without NPC progress
- Browser and Android manual verification record

**Out of scope:**

- Engine, API, persistence, auth, offline sync, restart, or result-history changes
- New automated tests or test files
- Transient feedback events, activity logs, sound, asset-heavy effects, or advanced animation polish
- Balance changes, new unit types, or NPC behavior changes

## Architecture / Approach

S-02 stays inside the existing Phaser match scene. The scene derives display state from the current `MatchSnapshot`, while the engine remains the only source of match truth and Angular remains responsible for hosting and result saving. The implementation should use stable primitive UI in the existing mobile portrait canvas and preserve the S-01 Phaser lifecycle.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Pressure And Frontline Readability | Blue/white/red pressure-state lane treatment | Color meaning may be unclear if labels are too subtle |
| 2. Build And Send State Clarity | One-tap unit cards with clearer states | Card styling could crowd or shift the mobile layout |
| 3. NPC Active Build Visibility | NPC current unit indicator without progress | Indicator may imply more precision than intended |
| 4. Manual Verification And Handoff | Browser and Android verification record | Android tooling or device access may slow confirmation |

**Prerequisites:** S-01 implemented match flow remains present and runnable.
**Estimated effort:** ~1-2 implementation sessions across 4 phases.

## Open Risks & Assumptions

- The later testing story will cover visual state mapping that S-02 deliberately leaves manual.
- Android readability still needs human confirmation because this is a mobile-first UI clarity slice.
- Existing match balance is sufficient to manually reach pushing, holding, and under-pressure states.

## Success Criteria (Summary)

- The player can visually distinguish pushing, holding, and under-pressure states during a match.
- Unit cards clearly communicate buildable, building, ready, and sendable states without changing the one-tap interaction.
- The NPC active build unit is visible, and browser plus Android verification are recorded.
