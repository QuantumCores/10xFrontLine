<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Android Session and Match Restoration Implementation Plan

- **Plan**: context/changes/testing-android-session-and-match-restoration/plan.md
- **Scope**: Phase 1 of 4
- **Date**: 2026-07-30
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | FAIL |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Active checkpoint saves can overwrite a durable pending result

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/mbl/src/app/core/session/match-session.store.ts:38
- **Detail**: `saveActive()` coalesces an equivalent active checkpoint but otherwise writes a new active envelope even when storage already contains `pending-result`. A delayed checkpoint callback could therefore destroy the sole completed-result payload before API confirmation, reversing the planned one-way active-to-pending transition. The store spec does not exercise pending-to-active rejection.
- **Fix**: Make pending-result terminal for `saveActive()` and add a regression test proving a stale active save leaves the exact pending request unchanged.
  - Strength: Preserves the plan's durable-result guarantee at the storage boundary where the transition is owned.
  - Tradeoff: The caller must treat the rejected or no-op save as expected once completion has been promoted.
  - Confidence: HIGH — the overwrite follows directly from the unconditional write at lines 46–57.
  - Blind spot: Runtime checkpoint callback ordering is introduced in later phases, so no current caller triggers this yet.
- **Decision**: SKIPPED — accepted as-is by user on 2026-07-30

### F2 — Checkpoint validation accepts states the engine cannot produce

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/mbl/src/app/play/match-engine.ts:419
- **Detail**: Active-build validation permits `startedAtMs + elapsedMs < match elapsedMs`, although live builds advance with every engine step and require equality. Completion validation also accepts duration and score values inconsistent with authoritative elapsed time and pressures. Corrupt checkpoints can therefore hydrate with lost build progress or contradictory derived completion data despite the plan's defensive invariant-validation contract.
- **Fix**: Enforce the cross-field build invariant and either validate completion duration/score against authoritative fields or omit and recompute those derived values; add rejection tests for each case.
  - Strength: Ensures every accepted checkpoint represents a state the engine could actually have emitted.
  - Tradeoff: Cross-field rules must remain synchronized with future engine timing and scoring semantics.
  - Confidence: HIGH — current production transitions establish the equalities, while validation checks only loose ranges.
  - Blind spot: Fractional deltas may require an explicit numeric tolerance if future callers introduce floating-point timing.
- **Decision**: SKIPPED — accepted as-is by user on 2026-07-30

### F3 — Restoration equivalence is not tested through completion

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/mbl/src/app/play/match-engine.spec.ts:144
- **Detail**: The hydration test compares immediate state and several subsequent deltas, but the match remains incomplete. It does not prove the planned equivalence of completion summary and final checkpoint after restored and uninterrupted engines reach completion.
- **Fix**: Extend the deterministic restoration scenario, or add a focused companion case, that drives both engines through completion and compares the completion and final checkpoints.
- **Decision**: SKIPPED — accepted as-is by user on 2026-07-30

## Verification Evidence

- `npm test -- --include src/app/play/match-engine.spec.ts` — PASS (1 file, 12 tests)
- `npm test -- --include src/app/core/session/match-session.store.spec.ts` — PASS (1 file, 7 tests)
- `npm run lint` — PASS
- `npm run build` — PASS (existing Phaser CommonJS optimization warning remains)
- Manual DTO review — PASS: schema/config versions and the discriminated persistence envelope are distinct from `MatchSnapshot`.
- Manual config/RNG review — PASS: the Phase 1 diff does not change balance constants; seeded continuation state is stored in the engine checkpoint within the match-session envelope.
