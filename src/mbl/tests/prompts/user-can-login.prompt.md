We are adding an E2E test for this standalone risk:
A legitimate player cannot complete passwordless sign-in and reach protected gameplay.

Research anchor:
PRD FR-001 and the implemented `/sign-in` → `/verify-code` → `/play` flow.

Business scenario (one observable behavior that must stay true after this flow):
After requesting and entering the issued passwordless code, the player reaches `/play`
and sees their signed-in email. If authentication or protected routing breaks, this test
must fail.

Real boundaries (do not mock — the risk hides here):
Angular forms and routing, ASP.NET Core auth endpoints, captured email delivery, JWT
issuance, the in-memory E2E database, and browser session storage.

Mocked boundaries (mock at network layer):
None. The E2E-only loopback endpoint reads the real code from captured email delivery;
it does not replace the request-code or verify-code flow.

Write a Playwright test following seed.spec.ts patterns and the E2E rules in AGENTS.md.
Assert the business outcome that would fail if this risk materialized.

Regression caught: a legitimate passwordless sign-in no longer establishes a session
that can enter the protected play route.
