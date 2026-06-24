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

## 10xDevs AI Toolkit - Module 2, Lesson 1

Move from sprint-zero setup to project orchestration with the **roadmap chain**:

```
(Module 1 foundation docs) -> /10x-roadmap -> backlog-ready roadmap items
```

`/10x-roadmap` is the lesson focus. `/10x-new` is intentionally introduced in Module 2, Lesson 2, when a selected roadmap item becomes an implementation change folder.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Roadmap (lesson focus)** | |
| `/10x-roadmap` | You have `context/foundation/prd.md` and a scaffolded project baseline, and you need a vertical-first MVP roadmap. The skill reads the PRD, inspects the code baseline, uses available foundation docs such as `tech-stack.md`, `infrastructure.md`, and `deploy-plan.md`, then writes `context/foundation/roadmap.md`. Use it BEFORE creating per-change folders or implementation plans. |
| **Re-run upstream if needed** | |
| `/10x-shape` / `/10x-prd` / `/10x-tech-stack-selector` / `/10x-bootstrapper` / `/10x-agents-md` / `/10x-infra-research` | Bundled from Module 1 so foundation contracts can be fixed before roadmap sequencing. If roadmap generation exposes a PRD gap, repair the PRD before pretending the backlog is ready. |

### How the chain hands off

- `/10x-roadmap` bridges product and implementation. It does not choose frameworks, design schemas, or write a per-change implementation plan.
- The output is `context/foundation/roadmap.md`: ordered milestones, vertical slices, bounded foundations, dependencies, unknowns, risk, and backlog handoff fields.
- Roadmap items should receive stable human-readable identifiers in backlog tools. The actual `context/changes/<change-id>/` folder is created in Lesson 2 with `/10x-new`.

### Roadmap boundaries

- Default to vertical slices: user-visible outcomes that cross UI, data, business logic, and integrations.
- Horizontal work is allowed only as a bounded enabler that names the downstream vertical milestone it unlocks.
- Avoid orphan horizontal work such as "build the whole database", "build all API endpoints", or "design the whole UI" before the first user-visible flow.
- Roadmap is not a calendar estimate. Do not invent dates, story points, or sprint velocity unless the user explicitly asks for a separate planning artifact.

### Foundation paths used by this lesson

- `context/foundation/prd.md` - input
- `context/foundation/tech-stack.md` - optional input
- `context/foundation/infrastructure.md` - optional input
- `context/deployment/deploy-plan.md` - optional input
- `context/foundation/roadmap.md` - output
- `context/foundation/lessons.md` - recurring rules and pitfalls
- `docs/reference/contract-surfaces.md` - load-bearing names registry

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
