---
change_id: address-npm-critical-high-vulnerabilities
title: Address npm critical and high vulnerabilities
status: implemented
created: 2026-08-10
updated: 2026-08-10
archived_at: null
---

## Notes

Removed all CRITICAL and HIGH npm audit findings without changing application behavior or masking advisories. `package.json` remained unchanged; `package-lock.json` now resolves patched versions within the existing semver ranges. Lint, 70 Angular tests, production build, and the Playwright authentication scenario pass.
