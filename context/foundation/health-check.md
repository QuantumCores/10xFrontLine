---
project: Front Line
checked_at: 2026-08-10T21:51:35.5367199Z
health_status: needs-attention
context_type: brownfield
language_family: multi
stack_assessment_available: false
checks_run:
  - lockfile
  - dependency_audit
  - outdated_deps
  - test_runner
  - ci_cd
  - configuration
audit_findings:
  critical: 0
  high: 0
  moderate: 9
  low: 0
test_runner_detected: true
ci_provider: GitHub Actions
recommended_fixes: 6
---

## Dependency Health

### Lockfile

Status: partial — `src/mbl/package-lock.json` is present; no NuGet `packages.lock.json` is committed
Package manager: npm and dotnet

The Angular dependency graph is reproducible, but transitive NuGet versions are not locked. Enable NuGet lock-file generation, run `dotnet restore src/api/frontLineApi.slnx`, and commit the generated lockfiles.

### Security Audit

Tools: `npm audit --json`; `dotnet list src/api/frontLineApi.slnx package --vulnerable --include-transitive`
Summary: 0 CRITICAL, 0 HIGH, 9 MODERATE, 0 LOW
Direct vs transitive: no CRITICAL/HIGH findings; 3 direct packages inherit MODERATE findings from 6 transitive package-level findings

NuGet reported no vulnerable packages in either `frontLineApi` or `frontLineApi.Tests`. All findings below come from the npm dependency graph.

#### CRITICAL findings

None. The lockfile refresh updated `tar` from 7.5.16 to 7.5.22.

#### HIGH findings

None. The refresh updated Angular runtime packages to 22.1.1, Angular build/CLI to 22.1.3, Capacitor packages to 8.5.0, and patched transitive Vite, Piscina, PostCSS, Nanoid, Immutable, brace-expansion, and js-yaml versions.

MODERATE findings: 9 package-level findings remain. They originate from `@hono/node-server` through the Angular CLI/MCP toolchain and `uuid` through Capacitor CLI/xcode; npm currently reports no compatible fix for these two advisory roots. Production-only audit reports 3 MODERATE and 0 CRITICAL/HIGH findings.

LOW findings: none.

### Outdated Dependencies

Packages with major version gaps: 3

- **eslint**: 9.39.5 → 10.8.1 (one major version behind)
- **phaser**: 3.90.0 → 4.2.1 (one major version behind)
- **typescript**: 6.0.3 → 7.0.2 (one major version behind)

No dependency is two or more major versions behind. Compatible Angular and Capacitor minor/patch updates were applied through the lockfile refresh.

## Test Suite

Test runner: Vitest through Angular CLI, xUnit, and Playwright
Tests found: 123 tests (70 Angular/Vitest, 52 API/xUnit, 1 browser E2E)
Test execution: passing

Configuration: `src/mbl/angular.json`, `src/mbl/tsconfig.spec.json`, `src/api.Tests/frontLineApi.Tests.csproj`, `src/mbl/playwright.config.ts`
Framework: Vitest 4.1.10, xUnit 2.9.2, Playwright 1.62.1

Verification on 2026-08-10 after the dependency refresh:

- `dotnet build src/api/frontLineApi.slnx --configuration Release --no-restore` — passed with 0 warnings and 0 errors.
- `dotnet test src/api/frontLineApi.slnx --configuration Release --no-build` — 52/52 passed. The run emitted noisy Windows Data Protection/Event Log diagnostics, but the test process passed.
- `npm run lint` — passed.
- `npm test -- --no-progress` — 70/70 passed across 16 files.
- `npm run build` — passed; Angular warned that Phaser is a non-ESM dependency.
- `npm run e2e -- --reporter=line` — 1/1 Playwright scenario passed in Chromium.

## CI/CD

Provider: GitHub Actions
Configuration: `.github/workflows/pr.yml`

| Stage | Status | Notes |
|---|---:|---|
| Lint | ✗ | Local `npm run lint` exists but CI does not run it |
| Test | ✓ | Runs API/xUnit and Angular/Vitest tests; Playwright E2E is not in CI |
| Build | ✓ | Builds the API, Angular app, and EF migration bundle |
| Type check | ✓ | C# compilation and Angular build perform compiler checks |
| Security | ✗ | No dependency audit, CodeQL, or equivalent scan is configured |

CI provides a solid build-and-unit-test gate. Add lint, dependency audit, and the certification E2E scenario so the evidence does not depend only on a local run.

## Configuration

### High severity

- **`src/mbl/tsconfig.json`** — several strict-adjacent flags are enabled, but TypeScript `strict` and Angular `strictTemplates` are not enabled. This contradicts the repository guidance that describes the client as strict and gives agents weaker compile-time feedback. Fix: enable `compilerOptions.strict` and `angularCompilerOptions.strictTemplates`, then resolve all diagnostics.

### Medium severity

- **Tracked generated file** — `src/api/obj/Debug/net10.0/frontLineApi.GlobalUsings.g.cs` is committed despite `obj/` being ignored and the repository rule forbidding build output in commits. Fix: run `git rm --cached src/api/obj/Debug/net10.0/frontLineApi.GlobalUsings.g.cs` and commit the index cleanup.
- **CI lint/security gaps** — local linting is configured and the dependency audit is actionable, but neither is enforced in `.github/workflows/pr.yml`. Fix: add `npm run lint`, `npm audit --audit-level=high`, and the corresponding NuGet vulnerability check after dependencies are updated.

### Low severity

- **`.editorconfig`** — missing. Add a root `.editorconfig` so formatting basics are consistent across C#, TypeScript, HTML, and SCSS editors.
- **`.env.example`** — missing, although `README.md` documents the important environment variables. Add a secret-free template or explicitly keep the README as the canonical configuration inventory.

Present and healthy: root `.gitignore`, `AGENTS.md`, `src/mbl/eslint.config.js`, `src/mbl/.prettierrc`, npm lockfile, nullable C#, and an existing GitHub Actions workflow.

## Stack Assessment Cross-Reference

No `context/foundation/stack-assessment.md` was found. Run `/10x-stack-assess` if a separate quality-gate analysis of the selected stack is needed.

## Recommended Fixes

### Fix before agent work (Category A)

### 1. Make TypeScript strictness match the repository claim

**Impact**: Agents and reviewers cannot rely on the full TypeScript strict-mode guarantees currently promised by `AGENTS.md`.
**Severity**: high
**Effort**: significant (> 1 hour)
**Fix**:

Add `"strict": true` under `compilerOptions` and `"strictTemplates": true` under `angularCompilerOptions` in `src/mbl/tsconfig.json`, then fix diagnostics and rerun lint, unit tests, and build.

### 2. Lock NuGet transitive dependencies

**Impact**: Exact .NET dependency resolution can drift between machines or dates, weakening reproducible verification.
**Severity**: medium
**Effort**: moderate (15–30 min)
**Fix**:

Enable `RestorePackagesWithLockFile` in the API and test projects, then run:

```powershell
dotnet restore src/api/frontLineApi.slnx
git add src/api/packages.lock.json src/api.Tests/packages.lock.json
```

### 3. Remove committed build output from the index

**Impact**: Generated files create noisy diffs and can mislead agents about which files are source-owned.
**Severity**: medium
**Effort**: quick (< 5 min)
**Fix**:

```powershell
git rm --cached src/api/obj/Debug/net10.0/frontLineApi.GlobalUsings.g.cs
```

### 4. Enforce lint and security checks in CI

**Impact**: A local green run can regress because pull requests currently do not enforce lint or dependency-security status.
**Severity**: medium
**Effort**: moderate (15–30 min)
**Fix**:

Update `.github/workflows/pr.yml` to run `npm run lint`, `npm audit --audit-level=high`, and `dotnet list src/api/frontLineApi.slnx package --vulnerable --include-transitive`. Add Playwright after its runtime cost and browser caching are accepted.

### 5. Add small cross-editor and configuration templates

**Impact**: Formatting and environment setup depend more heavily on local knowledge than necessary.
**Severity**: low
**Effort**: quick (< 5 min)
**Fix**:

Add a root `.editorconfig` and a secret-free `.env.example`, or state in `README.md` that it is the complete canonical environment-variable inventory.

### Addressed in upcoming lessons (Category B)

### Complete deployment automation and release evidence

**Lesson**: [Sprint Zero z Agentem: infrastruktura, walking skeleton i pierwszy deploy (M1L5)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5)
**What you'll do there**: Turn the existing infrastructure document and deployment plan into an executable deployment workflow, then retain proof of the public API or installable Android artifact.

## Summary

Health status: needs-attention

Front Line has strong executable verification: both applications build, 122 unit/integration tests pass, the user-facing Playwright login test passes, and GitHub Actions already enforces builds and unit tests. The npm dependency refresh removed all CRITICAL and HIGH findings; 9 MODERATE package-level findings remain without a compatible upstream fix. Strict TypeScript is still not fully enabled, NuGet lacks lockfiles, and one generated `obj` file is committed.

Next step: enable strict TypeScript and clean the committed generated file, then add security enforcement to CI so the 0 CRITICAL / 0 HIGH threshold cannot regress.
