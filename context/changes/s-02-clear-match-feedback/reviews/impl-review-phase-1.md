<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Clear Match Feedback

- **Plan**: context/changes/s-02-clear-match-feedback/plan.md
- **Scope**: Phase 1 of 4
- **Date**: 2026-07-23
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Final pressure treatment differs from the Phase 1 contract

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/mbl/src/app/play/frontline-match.scene.ts:174
- **Detail**: The plan requires lane fills, marker color, and nearby label treatment to match pressure state and requires readable boundary labels. The final implementation changes only the marker color, leaves lane fills and the `Pressure N` label state-neutral, and removes both boundary labels. These are deliberate adaptations explicitly requested and manually approved by the user, but the written contract no longer describes the delivered UI.
- **Fix**: Record the approved marker-only and label-removal decisions as an implementation deviation so later phases and final review use the delivered UX as their baseline.
  - Strength: Preserves the approved UI while making the source of truth explicit.
  - Tradeoff: Adds documentation instead of changing working code.
  - Confidence: HIGH — the conversation contains explicit direction and manual approval.
  - Blind spot: The repository has no established implementation-deviation section yet.
- **Decision**: FIXED — plan updated to document the approved compact marker-only layout.

### F2 — Rejected build taps now fail silently

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/mbl/src/app/play/frontline-match.scene.ts:155
- **Detail**: While one unit is building, every other idle card still says `BUILD`. Tapping one calls `startBuild`, receives `already-building`, and produces no visible response because the message area was removed. This is a usability regression from the S-01 baseline and weakens immediate interaction feedback.
- **Fix**: In Phase 2, give other cards a visibly unavailable state while `playerActiveBuild` is present and prevent their misleading build interaction.
- **Decision**: QUEUED — Phase 2 contract now requires visibly unavailable cards without restoring the message line.

### F3 — Phase 1 includes early Phase 2 progress work

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/mbl/src/app/play/frontline-match.scene.ts:107
- **Detail**: The stable in-card progress bar and percentage label implement part of Phase 2's build-progress contract. This was explicitly requested while resizing the battlefield and is coherent, but Phase 2 must treat it as existing work rather than duplicate or replace it accidentally.
- **Fix**: Retain the progress implementation as the Phase 2 baseline and verify it against Phase 2 success criteria.
- **Decision**: FIXED — Phase 2 plan now treats the existing in-card progress bar as its baseline.

## Verification Evidence

- `npm run build`: PASS. Angular production bundle generated successfully; the existing Phaser CommonJS optimization warning remains.
- `git diff e8d6909^ e8d6909 -- src/mbl/src/app/play/match-types.ts`: PASS. No engine contract diff.
- Test-file scope check for commit `e8d6909`: PASS. No `*.spec.*` or `*.test.*` files added or changed.
- Manual checks 1.4-1.6: CONFIRMED by the user after reviewing the final mobile viewport layout.
