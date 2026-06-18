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
