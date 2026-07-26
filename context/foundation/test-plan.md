# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-07-26

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the
   team is worried about X, and the failure would surface somewhere in
   an area" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/mbl/src/app`, `src/api`.

## 2. Risk Map

Risks are ordered by impact × likelihood. Sources identify evidence, not
failure-location anchors.

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|---|---|---|---|
| 1 | Android process recreation leaves a legitimate player logged out and unable to start or resume gameplay. | High | High | interview Q1–Q2; PRD lines 64–67, 108–110 |
| 2 | Restoring an interrupted match loses, duplicates, or corrupts player progress. | High | High | interview Q3; PRD lines 46–60; roadmap lines 24, 89–99 |
| 3 | Expired or invalid credentials during restoration cause a loop, destructive reset, or silent progress loss. | High | High | interview Q4; PRD lines 66–67, 100 |
| 4 | Strength, timing, or boundary handling produces an incorrect match outcome. | High | Medium | PRD lines 73–86, 102–106; hot-spot dir `src/mbl/src/app/play` — 21 changes/30d |
| 5 | A completed result is lost or saved more than once during connectivity interruption and retry. | High | Medium | PRD lines 90–100; roadmap lines 89–99 |
| 6 | A forged, expired, or different player's credential permits access to gameplay, results, or restorable match state. | High | Medium | PRD lines 108–110; authentication abuse review |

Impact is High when access or durable state can be lost or the core outcome is
wrong. Likelihood is High for user-reported lifecycle risks and Medium for
occasionally touched or requirement-derived risks without a known incident.

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|---|---|---|---|---|---|
| #1 | Lifecycle recreation returns a valid player to the appropriate playable or resumable state without another sign-in. | Minimizing always restarts the app; token presence proves a valid session. | Capacitor lifecycle, persisted session shape, guard initialization, startup ordering. | client integration plus lifecycle-adapter unit | mocking away storage and routing |
| #2 | Restoration creates one equivalent match state with no lost or duplicated actions. | Rendering the play screen proves restoration succeeded. | persisted match fields, save boundaries, clocks, randomness, restoration entry point. | deterministic state integration | expected state copied from production logic |
| #3 | Invalid credentials retain recoverable local state, request reauthentication once, and resume or fail explicitly by policy. | Every 401 should erase local data; final navigation proves safety. | error translation, token invalidation, pending-state ownership, reauthentication contract. | client/API contract plus client integration | happy-path-only assertions |
| #4 | Independent examples prove strength pressure, timing, boundaries, and outcome agree with product rules. | Current output is the oracle. | match rules, controllable time/randomness, boundary semantics. | deterministic unit or property-style | copied production calculation |
| #5 | Temporary failure retains pending work and repeated retries create one durable result. | A final 200 proves no duplicate write occurred. | result identity, idempotency rule, transaction boundary, retry ownership. | API integration plus client queue | over-mocking persistence |
| #6 | Invalid and cross-player credentials cannot read, submit, or restore another player's state. | Authentication automatically proves resource ownership. | authorization boundary, ownership identity, response and logging behavior. | API authorization integration | unauthenticated case only |

## 3. Phased Rollout

Each phase opens its own change folder. The orchestrator derives status from
the artifacts in that folder.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Android session and match restoration | Prove lifecycle recreation and credential failure cannot strand a player or silently destroy progress. | #1, #2, #3 | client integration, lifecycle unit, client/API contract | change opened | testing-android-session-and-match-restoration |
| 2 | Deterministic match and result integrity | Prove match outcomes and retried result persistence remain correct. | #4, #5 | deterministic unit/property-style, API integration, client queue | not started | — |
| 3 | Authorization abuse boundaries | Prove invalid and cross-player credentials cannot access protected state. | #3, #6 | API authorization integration, negative contract | not started | — |
| 4 | Quality-gate wiring and cookbook | Automate the cheapest stable checks and document the patterns delivered by the rollout. | #1–#6 | scoped local gates, post-edit hook, cookbook | not started | — |

Status vocabulary: `not started` → `change opened` → `researched` → `planned`
→ `implementing` → `complete`.

## 4. Stack

The test base is meaningful: ten Angular specs and seven API test/support files
span gameplay, authentication, results, email, API foundation, and API E2E.

| Layer | Tool | Version | Notes |
|---|---|---|---|
| client unit + integration | Angular unit-test builder + Vitest + happy-dom | Angular 22 / Vitest 4.0.8 | Configured in `angular.json`; deterministic DOM environment. |
| game logic | Vitest | 4.0.8 | Prefer controlled time and randomness over rendered-frame assertions. |
| API integration | xUnit + `WebApplicationFactory` | xUnit 2.9.2 / ASP.NET Core 10 | Separate `src/api.Tests` project with HTTP-host integration support. |
| coverage | coverlet collector | 8.0.0 | Coverage is diagnostic, not a substitute for risk assertions. |
| browser e2e | none planned | n/a | Current risks have cheaper deterministic and contract signals. |

**Stack grounding tools (current session):**
- Docs: no dedicated docs MCP — official Angular and Microsoft test documentation checked by web search; checked: 2026-07-26
- Search: web search — used only to locate current official framework guidance; checked: 2026-07-26
- Runtime/browser: no Playwright/browser-automation MCP — not used; checked: 2026-07-26
- Provider/platform: none relevant to these quality gates; checked: 2026-07-26

## 5. Quality Gates

Every gate below is already available or has a named rollout phase that will
wire it. Keep per-edit checks fast and scope tests to risk areas.

| Gate | Where | Required? | Catches |
|---|---|---|---|
| Angular lint + production build | local before commit/push | required | syntax, type, template, and bundle-budget drift |
| Client unit + integration suite | local; automated gate after §3 Phase 4 | required after §3 Phase 1 | lifecycle, restoration, and match regressions |
| API integration suite | local; automated gate after §3 Phase 4 | required after §3 Phase 2 | auth, ownership, persistence, and HTTP contract regressions |
| Scoped post-edit checks | local agent loop | recommended after §3 Phase 4 | fast feedback on risk-area edits |

## 6. Cookbook Patterns

How to add tests in this project. Rollout phases replace these placeholders with
verified locations, commands, fixtures, and reference tests.

### 6.1 Testing Android session or match restoration

- TBD — see §3 Phase 1 for lifecycle recreation, recoverable reauthentication, and equivalent-state restoration patterns.

### 6.2 Testing deterministic match rules

- TBD — see §3 Phase 2 for strength, timing, boundary, and outcome patterns with independent oracles.

### 6.3 Testing result retry and idempotency

- TBD — see §3 Phase 2 for pending-result retention and single-durable-write patterns.

### 6.4 Testing API authentication and ownership

- TBD — see §3 Phase 3 for invalid-token and cross-player authorization patterns.

### 6.5 Running scoped quality gates

- TBD — see §3 Phase 4 for per-edit, commit, and push commands selected by cost × signal.

### 6.6 Per-rollout-phase notes

- TBD — each completed rollout phase appends concise lessons here.

## 7. What We Deliberately Don't Test

- **Pixel-perfect Phaser animation-frame snapshots** — they are brittle and do
  not prove gameplay state or outcome correctness. Re-evaluate only if exact
  rendered frames become a contractual product requirement. (Source: Phase 2
  interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-07-26
- Stack versions last verified: 2026-07-26
- AI-native tool references last verified: 2026-07-26

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes,
- §7 negative-space no longer matches what the team believes.
