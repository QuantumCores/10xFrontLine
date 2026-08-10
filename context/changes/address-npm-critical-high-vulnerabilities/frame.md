# Frame Brief: Address npm CRITICAL and HIGH Vulnerabilities

> Framing step before implementation. This document separates the observed
> audit result from assumptions about how many dependency changes it requires.

## Reported Observation

The Angular/Capacitor workspace reports CRITICAL and HIGH vulnerabilities in `npm audit`.

## Initial Framing (preserved)

- **User's stated cause or approach**: Address the CRITICAL and HIGH findings reported by npm audit.
- **User's proposed direction**: Remove those security findings from the project.
- **Pre-dispatch narrowing**: Scope is exclusively npm CRITICAL/HIGH vulnerabilities; the TypeScript strictness finding is excluded.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Direct framework versions** — Angular 22.0.1 packages may be below patched 22.x releases.
2. **Locked transitive versions** — the lockfile may retain vulnerable tar, Vite, PostCSS, ESLint-chain, and related versions despite compatible patched releases.
3. **Unavailable compatible fixes** — some advisories might require a major upgrade, an override, or explicit risk acceptance.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Direct framework versions are stale | Angular runtime packages are locked at 22.0.1; the `@angular/common` advisory is fixed from 22.0.2, and current `^22.0.0` declarations admit 22.1.1. Angular build/CLI ranges admit 22.1.3. | STRONG |
| Transitive versions are stale | Current chains include `tar@7.5.16`, `vite@7.3.2`, `piscina@5.1.4`, `postcss@8.5.15`, `nanoid@3.3.12`, `immutable@5.1.6`, and vulnerable brace-expansion/js-yaml versions. Their parent ranges admit patched releases. | STRONG |
| Compatible fixes are unavailable | Registry checks found fixes for every CRITICAL/HIGH advisory. A temporary-copy `npm update --package-lock-only` produced 0 CRITICAL / 0 HIGH without changing `package.json`; no override or major upgrade was required. | NONE |

## Narrowing Signals

- The requested scope excludes non-security HIGH configuration findings.
- `npm audit fix --package-lock-only` was insufficient and left 7 HIGH findings.
- `npm update --package-lock-only` within existing declared ranges removed all CRITICAL/HIGH findings and left only 6 MODERATE findings.
- The critical `tar` fix is admitted by every current parent range; an override would add unnecessary maintenance risk.

## Cross-System Convention

For a stale npm lockfile whose declared semver ranges already admit patched versions, the conventional fix is to refresh dependency resolution, review the lockfile delta, install deterministically, rerun the audit, and execute the full project verification suite. Overrides are reserved for cases where parent ranges cannot resolve a fixed transitive version.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: `package-lock.json` pins vulnerable direct and transitive versions even though the existing `package.json` ranges admit patched releases that reduce npm audit to 0 CRITICAL and 0 HIGH.

The request is therefore not a collection of 53 independent fixes and does not require major-version upgrades. It is a controlled lockfile refresh followed by audit and regression verification.

## Confidence

- **HIGH** — two targeted dependency-chain investigations and one independent audit reached the same result, and a temporary-copy lockfile refresh demonstrated the target audit outcome.

## What Changes for Implementation

Refresh dependency resolution within the current manifest ranges, keep `package.json` unchanged unless npm proves otherwise, review the lockfile delta, then require 0 CRITICAL / 0 HIGH plus passing lint, unit tests, production build, and Playwright E2E.

## References

- Source files: `src/mbl/package.json`, `src/mbl/package-lock.json`
- Existing audit: `context/foundation/health-check.md`
- Investigation tasks: `/root/angular_audit_chain`, `/root/capacitor_tar_chain`, `/root/independent_audit`
