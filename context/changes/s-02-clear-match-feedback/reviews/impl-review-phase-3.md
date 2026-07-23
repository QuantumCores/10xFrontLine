<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Clear Match Feedback

- **Plan**: context/changes/s-02-clear-match-feedback/plan.md
- **Scope**: Phase 3 of 4
- **Date**: 2026-07-23
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Inactive NPC cards say WAITING during an active build

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/mbl/src/app/play/frontline-match.scene.ts:214
- **Detail**: The Phase 3 contract describes an active-unit display with a neutral waiting/idle fallback when `snapshot.npc.activeBuild` is absent. The implementation renders three permanent unit cards; while one card says `BUILDING`, the other two simultaneously say `WAITING`. The active unit is still identifiable and no progress leaks, but `WAITING` now describes inactive unit types rather than the NPC's idle state.
- **Fix**: Replace the three per-unit status cards with one compact NPC indicator that shows the configured active unit label plus `BUILDING`, or a single neutral `WAITING` state when no build is active.
  - Strength: Matches the plan's state semantics exactly and uses less of the top HUD band.
  - Tradeoff: Removes the current three-card visual treatment and requires a small layout adjustment.
  - Confidence: HIGH — the snapshot already provides the complete optional active-unit state needed by a single indicator.
  - Blind spot: The three-card design may have been explicitly preferred during an earlier manual review, but that decision is not recorded in the repository.
- **Decision**: FIXED — the plan now records the intended three-card behavior: the active unit says `BUILDING`, inactive units say `WAITING`, and all units say `WAITING` while the NPC is idle.

### F2 — Phase 3 removes the scene title without plan coverage

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/mbl/src/app/play/frontline-match.scene.ts:74
- **Detail**: Commit `c804ed5` replaces the existing `Front Line` title with the NPC controls. Reusing the top band avoids overlap, but removing user-visible title/branding was not listed in Phase 3's changes or scope guardrails.
- **Fix**: Record the title replacement as an intentional Phase 3 layout decision in the plan.
- **Decision**: FIXED — the plan now records replacement of the redundant `Front Line` title as an intentional top-HUD layout decision.

### F3 — Completed manual checks lack durable verification evidence

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/s-02-clear-match-feedback/plan.md:304
- **Detail**: Manual checks 3.4–3.6 are marked complete and attributed to `c804ed5`, but that commit contains only scene code and progress-checkbox updates. The active/idle branches and non-overlapping fixed coordinates are visible in code, but the claimed browser and Android executions, viewport/device, and observations are not auditable from the Phase 3 diff. Phase 4 is already planned to create the durable verification record.
- **Fix**: Ensure Phase 4's `manual-verification.md` records the browser and Android evidence that supports checks 3.4–3.6 before the change is archived.
- **Decision**: QUEUED — record the browser and Android evidence supporting Phase 3 checks 3.4–3.6 in `manual-verification.md` during Phase 4.

## Triage Summary

- **Fixed**: F1, F2
- **Queued**: F3 (Phase 4 manual-verification record)
- **Pending**: None

## Verification Evidence

- `npm run build` from `src/mbl`: PASS. Angular production output generated successfully; the existing Phaser CommonJS optimization warning remains non-blocking.
- `git diff c804ed5^ c804ed5 -- src/mbl/src/app/play/match-engine.ts`: PASS. No NPC strategy or cadence code changed.
- NPC information exposure scan: PASS. The scene reads only `snapshot.npc.activeBuild?.unitType`; it does not read or display NPC progress, elapsed time, duration, or remaining time.
- Layout bounds inspection: PASS. NPC cards occupy x=10..380 and y=12..64 inside the 390x844 canvas; the lane begins at y=76 and player controls at y=650.
- `git diff --check c804ed5^..c804ed5`: PASS.

## Scope Notes

- Product implementation is confined to `src/mbl/src/app/play/frontline-match.scene.ts`; the only other commit change is Phase 3 progress bookkeeping in `plan.md`.
- The Phaser snapshot-rendering boundary, Angular completion callback, engine behavior, and result-saving ownership remain unchanged.
