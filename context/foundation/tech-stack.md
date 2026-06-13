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

## Why this stack

Front Line is a solo-built Android strategy game with a three-week, after-hours MVP timeline. Angular with TypeScript is the registered primary starter and provides explicit types, mature conventions, and current documentation. Phaser supplies the browser-first game loop, Capacitor packages it for Android, and ASP.NET Core with SQL Server supports passwordless authentication and saved match results. The API will be self-hosted, with GitHub Actions checks and manual deployment promotion. Bootstrapper confidence is best-effort because the registry does not provide a combined Angular, Phaser, Capacitor, ASP.NET Core, and SQL Server starter, so those integrations require manual setup.
