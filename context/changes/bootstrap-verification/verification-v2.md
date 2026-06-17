---
bootstrapped_at: 2026-06-13T21:25:52Z
starter_id: angular
starter_name: Angular
project_name: front-line
language_family: js
package_manager: npm
cwd_strategy: subdir-then-move
scaffold_name: bootstrap-scaffold
bootstrapper_confidence: best-effort
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

```yaml
---
starter_id: angular
package_manager: npm
project_name: front-line
hints:
  language_family: js
  team_size: solo
  deployment_target: self-host
  ci_provider: github-actions
  ci_default_flow: manual-promotion
  bootstrapper_confidence: best-effort
  path_taken: custom
  quality_override: false
  self_check_answers:
    typed: true
    from_official_starter: true
    conventions: true
    docs_current: true
    can_judge_agent: true
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---
```

## Why this stack

Front Line is a solo-built Android strategy game with a three-week, after-hours MVP timeline. Angular with TypeScript is the registered primary starter and provides explicit types, mature conventions, and current documentation. Phaser supplies the browser-first game loop, Capacitor packages it for Android, and ASP.NET Core with SQL Server supports passwordless authentication and saved match results. The API will be self-hosted, with GitHub Actions checks and manual deployment promotion. Bootstrapper confidence is best-effort because the registry does not provide a combined Angular, Phaser, Capacitor, ASP.NET Core, and SQL Server starter, so those integrations require manual setup.

## Pre-scaffold verification

| Signal | Value | Severity | Notes |
| --- | --- | --- | --- |
| npm package | not run | unavailable | The registered command invokes `npx @angular/cli`, not a derivable `create-*` package. |
| GitHub repo | not run | unavailable | The registry card documentation URL is `https://angular.dev`, not a GitHub repository URL. |

## Scaffold log

**Resolved invocation**: `npx @angular/cli new bootstrap-scaffold --defaults --routing --style scss --skip-tests --ssr false`
**Strategy**: subdir-then-move
**Exit code**: 0 after resuming dependency installation with `NODE_OPTIONS=--use-system-ca`
**Files moved**: 16 root entries
**Conflicts (.scaffold siblings)**: none
**.gitignore handling**: moved silently
**Temporary scaffold cleanup**: `bootstrap-scaffold` deleted
**Project identifier correction**: generated identifiers changed from `bootstrap-scaffold` to `front-line` before merge
**Build verification**: `npm run build` passed from the repository root

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 3 HIGH, 0 MODERATE, 0 LOW
**Direct vs transitive**: 1 direct HIGH (`@angular/build`); 2 transitive HIGH (`esbuild`, `vite`)

#### HIGH findings

- `@angular/build`: direct development dependency affected through `esbuild` and `vite`; no fix currently available.
- `esbuild`: affected by GHSA-gv7w-rqvm-qjhr and GHSA-g7r4-m6w7-qqqr; no fix currently available through the Angular dependency tree.
- `vite`: affected through `esbuild`; a fix is available upstream, but not currently resolvable without changing Angular's dependency tree.

## Hints recorded but not acted on

| Hint | Value |
| --- | --- |
| bootstrapper_confidence | best-effort |
| quality_override | false |
| path_taken | custom |
| self_check_answers | typed: true; from_official_starter: true; conventions: true; docs_current: true; can_judge_agent: true |
| team_size | solo |
| deployment_target | self-host |
| ci_provider | github-actions |
| ci_default_flow | manual-promotion |
| has_auth | true |
| has_payments | false |
| has_realtime | false |
| has_ai | false |
| has_background_jobs | false |

## Next steps

The Angular project is scaffolded, installed, merged into the current directory, and verified with a production build. Review the three HIGH development-toolchain audit findings as Angular publishes compatible dependency updates.
