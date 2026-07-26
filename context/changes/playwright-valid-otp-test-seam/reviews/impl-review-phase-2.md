<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Playwright Valid OTP Test Seam Implementation Plan

- **Plan**: context/changes/playwright-valid-otp-test-seam/plan.md
- **Scope**: Phase 2 of 3
- **Date**: 2026-07-26
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 0 observations

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

### F1 — Loopback guard trusts the immediate proxy hop

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/api/E2E/E2eAuthEndpoints.cs:27
- **Detail**: `IPAddress.IsLoopback(context.Connection.RemoteIpAddress)` proves only that the immediate peer is local. If an E2E host is accidentally placed behind a same-machine reverse proxy, an external request can arrive at Kestrel from the proxy's loopback address and pass this guard. Exact-E2E-only mapping and the access key remain independent protections, so this is defense-in-depth rather than a direct credential bypass. The current non-loopback test injects a direct remote address and does not exercise the proxy-shaped case.
- **Fix A ⭐ Recommended**: Make loopback-only binding and “never proxy E2E” an enforced host invariant, then add a test for non-loopback listener configuration.
  - Strength: Fits the intentionally local, documentation-driven E2E mode without introducing production proxy machinery.
  - Tradeoff: Binding validation must cover every supported Kestrel configuration source; a local proxy could still violate the operational rule if explicitly configured.
  - Confidence: MED — this matches the planned `127.0.0.1` workflow, but Phase 3 documentation is not implemented yet.
  - Blind spot: The repository does not yet define whether E2E will ever be run behind a reverse proxy.
- **Fix B**: Configure trusted forwarded headers for explicitly known proxies and validate the effective originating address.
  - Strength: Preserves the caller-origin guarantee even when E2E is deliberately proxied.
  - Tradeoff: Adds security-sensitive proxy configuration and test complexity to a localhost-only development seam.
  - Confidence: MED — technically standard, but likely broader than the intended local workflow.
  - Blind spot: No target proxy topology or trusted-proxy list exists in the current plan.
- **Decision**: PENDING

## Verification

### Automated

- PASS — `dotnet test src/api/frontLineApi.slnx --filter FullyQualifiedName~E2eLoginCodeEndpointTests`: 19 passed, 0 failed.
- PASS — `dotnet test src/api/frontLineApi.slnx --filter FullyQualifiedName~AuthEndpointTests`: 6 passed, 0 failed.
- PASS — `dotnet build src/api/frontLineApi.slnx`: build succeeded with 0 errors.
- Context — all commands emitted the pre-existing `NU1903` warning for `Microsoft.OpenApi` 2.0.0. Phase 2 did not change package references, so this is not attributed to this implementation.

### Manual

- PASS — Progress item 2.4 is checked and observable: `src/api/Program.cs:130` nests `MapE2eAuthEndpoints()` under exact `IsEnvironment("E2E")`; committed application settings contain no E2E access key.

## Review Notes

- Commit `243091c` changed exactly the five Phase 2 implementation/test files plus plan progress metadata.
- All five planned contracts materially match the implementation; no guardrail or out-of-scope changes were found.
- Access-key validation uses the planned minimum-length and placeholder rejection. Actual entropy remains an operator-generation property to be documented in Phase 3.
