---
bootstrapped_at: 2026-06-13T19:01:31Z
starter_id: angular
starter_name: Angular
project_name: front-line
language_family: js
package_manager: npm
cwd_strategy: subdir-then-move
bootstrapper_confidence: best-effort
phase_3_status: failed
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

**Resolved invocation**: `npx @angular/cli new .bootstrap-scaffold --defaults --routing --style scss --skip-tests --ssr false`
**Strategy**: subdir-then-move
**Exit code**: 1
**Stderr (last 20 lines)**:

```text
Schematic input does not validate against the Schema: {"projectRoot":"","name":".bootstrap-scaffold","prefix":"app","routing":true,"style":"scss","skipTests":true,"testRunner":"vitest","skipPackageJson":false,"skipInstall":true,"strict":true,"minimal":false,"standalone":true,"ssr":false,"fileNameStyleGuide":"2025"}
Errors:

  Data path "/name" must match pattern "^(?:@[a-zA-Z0-9-*~][a-zA-Z0-9-*._~]*/)?[a-zA-Z0-9-~][a-zA-Z0-9-._~]*$".
```

**.bootstrap-scaffold left in place at**: not created by CLI

## Post-scaffold audit

**Audit not run**: scaffold halted at Step 2; no project to audit.

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

The Angular CLI rejected the bootstrapper's required `.bootstrap-scaffold` temporary project name because current Angular project names cannot begin with a dot. Update the bootstrapper's temporary directory strategy or registry command, then re-invoke `/10x-bootstrapper`.
