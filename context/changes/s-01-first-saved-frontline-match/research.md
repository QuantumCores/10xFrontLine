---
date: 2026-06-28T16:44:46+02:00
researcher: Codex
git_commit: a97269cb82e47c237ace4b0ebbd5d592e8af25f7
branch: master
repository: TenXFrontLine
topic: "Review src/mbl, tech stack, and Phaser API notes for S-01 compatibility"
tags: [research, codebase, angular, phaser, s-01, match-results]
status: complete
last_updated: 2026-06-28
last_updated_by: Codex
---

# Research: Review src/mbl, tech stack, and Phaser API notes for S-01 compatibility

**Date**: 2026-06-28T16:44:46+02:00
**Researcher**: Codex
**Git Commit**: a97269cb82e47c237ace4b0ebbd5d592e8af25f7
**Branch**: master
**Repository**: TenXFrontLine

## Research Question

Review this codebase at `src/mbl`, `context/foundation/tech-stack.md` and decide whether `context/changes/phaser-api-docs.md` is compatible with it. We want to implement S-01 from `context/foundation/roadmap.md`.

## Summary

`context/changes/phaser-api-docs.md` is compatible with the current codebase and stack direction for S-01, with adaptations. The stack source of truth explicitly says Angular is the primary TypeScript shell and Phaser supplies the browser-first game loop, with manual integration expected because no combined starter exists (`context/foundation/tech-stack.md:29`). The Phaser note follows that same model: add Phaser to the existing Angular app rather than replacing the scaffold (`context/changes/phaser-api-docs.md:16`).

The main compatibility constraints are practical, not architectural:

- `phaser` is not installed yet in `src/mbl/package.json`, so S-01 must add it (`src/mbl/package.json:13`).
- The official Phaser Angular template must be treated as an integration reference only, because this app is Angular 22 / TypeScript 6 while the note says the template targets Angular 19.2 / TypeScript 5.7 (`src/mbl/package.json:14`, `src/mbl/package.json:29`, `context/changes/phaser-api-docs.md:26`).
- Phaser should be lazy-loaded through the protected `/play` feature because the production initial bundle budget errors above 1 MB (`src/mbl/angular.json:60`, `src/mbl/src/app/app.routes.ts:17`).
- Persistence should remain in Angular/API code. Phaser should emit a completed match payload; Angular should call the existing `ResultsApiClient.saveCompletedResult()` contract (`src/mbl/src/app/core/api/results-api.client.ts:32`).

## Detailed Findings

### Angular App Shape

- `src/mbl` is a standalone Angular app, not NgModule-based. The app starts with `bootstrapApplication(App, appConfig)` and renders a root router outlet (`src/mbl/src/main.ts:1`, `src/mbl/src/app/app.html:1`).
- App configuration already owns router and HTTP setup. It provides `provideHttpClient(withInterceptors([authInterceptor]))` and `provideRouter(routes)` (`src/mbl/src/app/app.config.ts:8`).
- Runtime dependencies currently include Angular, RxJS, and tslib only. Phaser is absent and must be added by S-01 (`src/mbl/package.json:13`).
- The current test setup is Vitest through Angular's unit-test builder with Happy DOM available in dev dependencies (`src/mbl/angular.json:94`, `src/mbl/package.json:27`). Phaser canvas/WebGL code should be isolated from unit tests; deterministic match rules should live in plain TypeScript.

### Route and Auth Integration

- `/play` already exists as the protected play surface and is guarded by `authGuard` (`src/mbl/src/app/app.routes.ts:17`).
- `authGuard` returns `true` only when `AuthStateService.isAuthenticated()` is true; otherwise it redirects to `/sign-in` with a `returnUrl` (`src/mbl/src/app/core/auth/auth.guard.ts:6`).
- The existing `/play` placeholder already injects `ResultsApiClient`, `AuthService`, `AuthStateService`, and `Router`, then posts a smoke result (`src/mbl/src/app/protected/protected-placeholder.component.ts:13`, `src/mbl/src/app/protected/protected-placeholder.component.ts:35`).
- S-01 should replace or route away from this placeholder with a real match page. Prefer a lazy-loaded standalone match route/component so Phaser does not inflate the initial production bundle.

### Build and Asset Compatibility

- Angular copies assets from `src/mbl/public` into the browser build (`src/mbl/angular.json:48`). This matches the Phaser note's recommendation to place game assets under `src/mbl/public/assets` and load them as `assets/...` (`context/changes/phaser-api-docs.md:55`).
- Production build budgets are tight: initial bundle warning at 500 kB and error at 1 MB (`src/mbl/angular.json:60`). Phaser should not be imported by `app.config.ts`, root `App`, or eagerly loaded route code.
- SCSS is already configured as the inline style language and component convention (`src/mbl/angular.json:47`). New Angular host components should follow existing `.component.ts/html/scss` file shape.

### Phaser Note Compatibility

- The Phaser note recommends Phaser 3, specifically the current stable Phaser 3 API line documented as 3.90.0 (`context/changes/phaser-api-docs.md:22`). That is compatible with the stack decision, which names Phaser as the browser-first game-loop library (`context/foundation/tech-stack.md:29`).
- The recommended ownership split is correct for this repo: Angular handles app shell, auth state, routing, API calls, and result submission; Phaser handles canvas, loop, input, and visual feedback (`context/changes/phaser-api-docs.md:45`).
- The note's lifecycle warnings are directly relevant: create one `Phaser.Game` per mounted Angular host and destroy it on component teardown (`context/changes/phaser-api-docs.md:69`, `context/changes/phaser-api-docs.md:269`).
- The suggested file shape under `src/mbl/src/app/game/` is compatible with the current app layout, but the route should be lazy-loaded and the pure engine should be testable without Phaser (`context/changes/phaser-api-docs.md:213`).

### S-01 Product and Contract Constraints

- S-01 is the north-star slice: signed-in player, three unit types, automated NPC, strength-driven frontline movement, clear win/loss, saved result (`context/foundation/roadmap.md:24`, `context/foundation/roadmap.md:65`).
- The PRD requires three unit types, one player unit building at a time, visible progress, player send action, NPC auto-build/send, score-driven movement, boundary win/loss, and saved result (`context/foundation/prd.md:54`, `context/foundation/prd.md:71`, `context/foundation/prd.md:104`).
- The backend result endpoint is already protected with `[Authorize]` and routed at `api/results` (`src/api/Controllers/ResultsController.cs:10`).
- The Angular result client already matches the API request shape: `clientMatchId`, `outcome`, `durationSeconds`, `completedAt`, `finalScore`, and `finalFrontlinePosition` (`src/mbl/src/app/core/api/results-api.client.ts:9`).
- API validation constrains S-01 outputs: outcome must be `Victory` or `Defeat`, duration must be 1 to 86,400 seconds, completed time must not be more than 5 minutes in the future or older than 30 days, final score must be within -10,000 to 10,000, and final frontline position must be 0 to 100 (`src/api/Results/MatchResultService.cs:12`, `src/api/Results/MatchResultService.cs:76`, `src/api/Results/MatchResultService.cs:81`, `src/api/Results/MatchResultService.cs:91`, `src/api/Results/MatchResultService.cs:96`).
- Results are idempotent only when the same player repeats the same `clientMatchId` and payload; a different payload for the same ID conflicts (`src/api/Results/MatchResultService.cs:31`, `src/api/Results/MatchResultService.cs:36`, `src/api/Results/MatchResultService.cs:104`). S-01 should create one stable client match ID per match and reuse it only for retrying that exact completed summary.

## Code References

- `context/foundation/tech-stack.md:29` - Stack decision: Angular shell, Phaser game loop, Capacitor Android packaging, ASP.NET Core + SQL Server for auth and saved results.
- `context/changes/phaser-api-docs.md:16` - Phaser note explicitly says to add Phaser to the existing Angular app rather than replace the scaffold.
- `src/mbl/package.json:13` - Runtime dependency list lacks Phaser.
- `src/mbl/angular.json:48` - Public assets are copied into the Angular browser build.
- `src/mbl/angular.json:60` - Production initial bundle budget is strict enough to make lazy-loading important.
- `src/mbl/src/app/app.routes.ts:17` - `/play` route is already protected and is the natural S-01 entry point.
- `src/mbl/src/app/core/api/results-api.client.ts:32` - Angular save client posts completed results to the API.
- `src/api/Controllers/ResultsController.cs:10` - Result save endpoint is authenticated.
- `src/api/Contracts/Results/CompletedResultRequest.cs:5` - Backend request contract for saved match summaries.
- `src/api/Results/MatchResultService.cs:62` - Server-side validation for result saves.

## Architecture Insights

- Keep S-01 as a vertical slice, not a scaffold migration. Phaser should enter the app as a contained game feature under the existing Angular route/auth/API structure.
- Use a pure or mostly pure TypeScript match engine for unit choices, build timers, NPC sends, scoring, frontline position, and completion. Phaser should render snapshots and forward input; Angular should save the final result.
- Lazy-load the game feature to protect the production initial bundle budget. Avoid root imports of Phaser.
- Keep result saving outside Phaser so S-03 can later add resilient result sync without rewriting scene logic.
- Use primitives for S-01 rendering. The Phaser note's rectangle/graphics/text approach is consistent with the roadmap risk: prove the loop before polishing feedback.

## Historical Context

- F-01 was designed as the prerequisite foundation for S-01: passwordless auth plus a protected completed-result write contract (`context/changes/f-01-minimal-authenticated-result-contract/plan.md:5`, `context/changes/f-01-minimal-authenticated-result-contract/plan.md:13`).
- F-01 deliberately excluded match history, offline pending-result queue, backend-authoritative simulation, polished game UI, Capacitor setup, and deployment work (`context/changes/f-01-minimal-authenticated-result-contract/plan.md:24`).
- The roadmap assigns resilient/offline result sync to S-03, after S-01 (`context/foundation/roadmap.md:91`).

## Related Research

- `context/changes/phaser-api-docs.md` - External Phaser API and Angular template research for S-01.
- No other `research.md` artifacts currently exist under `context/changes/` or `context/archive/`.

## Open Questions

- The exact Phaser npm version should be locked during implementation. The existing note recommends Phaser 3.90.0, but `npm install phaser` may resolve a newer version depending on the registry at implementation time.
- S-01 needs a concrete match-engine balance choice: unit names, strengths, build times, NPC cadence, score-to-position movement, and boundary thresholds.
- Capacitor is named in the stack but not installed. That is acceptable for browser-first S-01, but Android packaging should not be claimed until a later setup/verification step adds it.
