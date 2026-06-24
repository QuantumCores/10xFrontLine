---
project: Front Line
version: 1
status: draft
created: 2026-06-23
updated: 2026-06-23
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: Front Line

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Front Line gives mobile strategy players a short tactical match without large systems or decision paralysis. The product centers on one push-and-pull frontline where three unit choices, build timing, NPC pressure, and visible movement create meaningful decisions in a focused session.

## North star

Here, north star means the smallest end-to-end slice whose successful delivery proves the product's core idea. **S-01: Player completes the first saved frontline match** - this is the earliest proof that a signed-in player can use three unit types against an automated NPC, move the frontline through strength-driven scoring, reach a clear win or loss, and save the result.

## At a glance

| ID | Change ID | Outcome (user can ...) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| F-01 | minimal-authenticated-result-contract | (foundation) passwordless identity and a completed-result write contract are ready for the first match flow | - | FR-001, FR-010, Access Control | ready |
| S-01 | first-saved-frontline-match | signed-in player can complete the first saved frontline match against an automated NPC | F-01 | US-01, FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010 | proposed |
| S-02 | clear-match-feedback | player can clearly read build progress, send feedback, and frontline pressure during a match | S-01 | US-01, FR-002, FR-004, FR-005, FR-008 | proposed |
| S-03 | resilient-result-sync | player can complete a match during temporary network loss without losing the result | F-01, S-01 | US-01, FR-010 | proposed |
| S-04 | restart-completed-match | player can restart after a completed match | S-01 | US-01, FR-011 | proposed |

## Baseline

What's already in place in the codebase as of `2026-06-23` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** partial - mobile client scaffold and build tooling exist; routing is configured but empty, and no game-specific component layer is present (`src/mbl/package.json:14`, `src/mbl/angular.json:43`, `src/mbl/src/app/app.routes.ts:3`).
- **Backend / API:** present - API scaffold exists, controllers are registered and mapped, and the sample weather route is the only implemented route (`src/api/Program.cs:12`, `src/api/Program.cs:29`, `src/api/Controllers/WeatherForecastController.cs:5`).
- **Data:** partial - database choice is documented, but no driver, persistence model, migrations, schema, or seeds are implemented (`src/api/frontLineApi.csproj:10`, `context/foundation/infrastructure.md:11`).
- **Auth:** partial - authorization middleware is present, but passwordless code issuance, verification, protected routes, and client auth flow are absent (`src/api/Program.cs:26`, `src/api/Controllers/WeatherForecastController.cs:5`, `src/mbl/src/app/app.routes.ts:3`).
- **Deploy / infra:** partial - self-host target and deployment runbook exist in docs, but no CI workflow, container config, or infrastructure automation exists (`context/foundation/tech-stack.md:8`, `context/foundation/infrastructure.md:16`, `context/changes/deployment/deployment-plan.md:319`).
- **Observability:** partial - built-in logging configuration exists, but error tracking, metrics, dashboards, and runtime observability middleware are absent (`src/api/appsettings.json:2`, `src/api/Program.cs:19`, `src/mbl/src/app/app.config.ts:8`).

## Foundations

### F-01: Minimal Authenticated Result Contract

- **Outcome:** (foundation) passwordless player identity and the minimal completed-result write contract are in place for the first saved match.
- **Change ID:** minimal-authenticated-result-contract
- **PRD refs:** FR-001, FR-010, Access Control
- **Unlocks:** S-01, S-03, protected match-result verification path
- **Prerequisites:** -
- **Parallel with:** -
- **Blockers:** -
- **Unknowns:** -
- **Risk:** Sequenced first because every playable match starts from an authenticated player and the PRD requires saved results; the risk is overbuilding account or history features before the first match consumes them.
- **Status:** ready

## Slices

### S-01: Player Completes The First Saved Frontline Match

- **Outcome:** signed-in player can complete the first saved frontline match against an automated NPC.
- **Change ID:** first-saved-frontline-match
- **PRD refs:** US-01, FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010
- **Prerequisites:** F-01
- **Parallel with:** -
- **Blockers:** -
- **Unknowns:** -
- **Risk:** This intentionally takes the shortest complete path through the MVP; the risk is letting feedback polish or persistence hardening delay the first playable proof.
- **Status:** proposed

### S-02: Clear Match Feedback

- **Outcome:** player can clearly read build progress, send feedback, and frontline pressure during a match.
- **Change ID:** clear-match-feedback
- **PRD refs:** US-01, FR-002, FR-004, FR-005, FR-008
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04
- **Blockers:** -
- **Unknowns:** -
- **Risk:** This follows the first playable match because clarity is the main quality guardrail; the risk is polishing animation before the loop exists.
- **Status:** proposed

### S-03: Resilient Result Sync

- **Outcome:** player can complete a match during temporary network loss without losing the result.
- **Change ID:** resilient-result-sync
- **PRD refs:** US-01, FR-010
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-02, S-04
- **Blockers:** -
- **Unknowns:** -
- **Risk:** This protects the saved-result requirement after the core loop works; the risk is treating offline safety as a full sync platform instead of a narrow pending-result path.
- **Status:** proposed

### S-04: Restart Completed Match

- **Outcome:** player can restart after a completed match.
- **Change ID:** restart-completed-match
- **PRD refs:** US-01, FR-011
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-03
- **Blockers:** -
- **Unknowns:** -
- **Risk:** This is sequenced after the completed match because restart only matters once a match can end; the risk is spending deadline pressure on a nice-to-have before the first saved match lands.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
|---|---|---|---|---|
| F-01 | minimal-authenticated-result-contract | Establish minimal authenticated result contract | yes | Run `/10x-plan minimal-authenticated-result-contract`; this unlocks S-01. |
| S-01 | first-saved-frontline-match | Build the first saved frontline match | no | Depends on F-01. |
| S-02 | clear-match-feedback | Make match feedback clear during play | no | Depends on S-01. |
| S-03 | resilient-result-sync | Preserve completed results during temporary network loss | no | Depends on F-01 and S-01. |
| S-04 | restart-completed-match | Add restart after completed match | no | Depends on S-01. |

## Open Roadmap Questions

None.

## Parked

- **Real-time multiplayer, social features, or leaderboard** - Why parked: PRD Non-Goals; the MVP proves a focused single-player match.
- **Complex AI, pathfinding, physics-based combat, or backend-authoritative simulation** - Why parked: PRD Non-Goals; these do not contribute to proving the frontline rule.
- **Campaign, progression, economy, upgrades, inventory, or many additional unit types** - Why parked: PRD Non-Goals; the MVP remains limited to the first playable match.
- **Monetization, ads, push notifications, or iOS support** - Why parked: PRD Non-Goals; they do not validate the Android gameplay loop.
- **Advanced animation, visual effects, soundtrack, or advanced sound design** - Why parked: PRD Non-Goals; gameplay clarity takes priority over production polish.
- **Deployment automation beyond what is needed for MVP verification** - Why parked: sequencing goal is speed and the deployment runbook already exists as a separate change artifact.

## Done

<!-- Empty on first generation. `/10x-archive` appends entries here when matching changes are archived. -->
