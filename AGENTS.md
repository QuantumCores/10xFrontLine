# Repository Guidelines

Front Line is a small polyglot project: an Angular mobile/browser client in `src/mbl`, an ASP.NET Core API in `src/api`, and planning artifacts under `context/foundation`. Treat `context/foundation/prd.md` and `context/foundation/tech-stack.md` as the product and stack source of truth.

## Hard Rules

Do not write to `context/archive/`; archived changes are immutable. Open a new change under `context/changes/` instead.

Keep generated build output out of commits. `src/api/bin/`, `src/api/obj/`, and Angular build artifacts are local outputs, not source.

## Project Structure & Module Organization

- `src/mbl/` contains the Angular 22 app. App code lives in `src/mbl/src/app`, global styles in `src/mbl/src/styles.scss`, and static assets in `src/mbl/public`.
- `src/api/` contains the `frontLineApi` ASP.NET Core `net10.0` project. Controllers live in `src/api/Controllers`; configuration is in `appsettings*.json`.
- `context/foundation/` holds product, shaping, and stack decisions. `context/changes/bootstrap-verification/` records scaffold verification notes.

## Build, Test, and Development Commands

Run Angular commands from `src/mbl`:

- `npm install` installs the pinned npm dependency set from `package-lock.json`.
- `npm start` starts the Angular development server.
- `npm run build` creates the production Angular build and enforces the configured bundle budgets.
- `npm test` is the declared test command; verify the Angular test target exists before relying on it in CI.

Run API commands from the repo root:

- `dotnet build src/api/frontLineApi.csproj` compiles the API.
- `dotnet run --project src/api/frontLineApi.csproj` starts the local API.

## Coding Style & Naming Conventions

Angular uses TypeScript with strict compiler checks from `src/mbl/tsconfig.json`, SCSS component styles, and the `app` selector prefix from `angular.json`. Keep Angular app files in the existing `app.<kind>.ts/html/scss` style unless introducing a real feature directory.

The API uses nullable-enabled C# with implicit usings. Keep controller classes under `src/api/Controllers` and preserve the current namespace style rooted at `frontLineApi`.

## Testing Guidelines

No committed specs or API test project exist yet. For Angular tests, place `*.spec.ts` files under `src/mbl/src` so `tsconfig.spec.json` includes them. For API tests, add a separate test project rather than mixing tests into `src/api`.

## Commit & Pull Request Guidelines

Commit messages use short `QC:` commit prefixes, for example `QC: tech stack`. Keep subjects concise and imperative. Pull requests should name the touched area (`src/mbl`, `src/api`, or `context`), link the relevant context document or issue, list commands run, and include screenshots for UI changes.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 3, Lesson 4 (E2E Tests)

**For E2E tests, use the `/10x-e2e` skill.** It is the single source of truth
for the workflow — risk → seed test + rules → generate → review against the five
anti-patterns → re-prompt → verify. The skill's `references/` carry the full
rules, anti-patterns, seed pattern, and prompt-template.

A few hard rules that hold even before you invoke the skill:

- **Locators:** `getByRole` / `getByLabel` / `getByText` first; `getByTestId`
  only when accessibility attributes are ambiguous. Never CSS selectors, XPath,
  or DOM structure.
- **Never `page.waitForTimeout()`.** Wait for state: `toBeVisible()`,
  `waitForURL()`, `waitForResponse()`.
- **Test independence + cleanup.** Each test runs standalone — its own setup,
  action, assertion, and cleanup; unique ids (timestamp suffix) so parallel runs
  and re-runs don't collide.

Two boundaries to keep straight:

- **DOM (snapshot) is the default.** Vision (`--caps=vision`) is a supplement for
  visual-only risks (layout, z-index, animation); for pixel regression prefer
  deterministic tools (`toMatchSnapshot`, Argos, Lost Pixel). VLM model
  selection/cost is a debugging topic (Lesson 5), not testing.
- **Healer helps on selectors, harms on logic.** A changed selector → healer
  re-finds it (route through PR review). A changed business behavior → healer
  masks the bug; that failing-test-to-fix case is Lesson 5.

<!-- END @przeprogramowani/10x-cli -->
