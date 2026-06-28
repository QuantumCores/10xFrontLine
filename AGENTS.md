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

## 10xDevs AI Toolkit - Module 2, Lesson 4

Prepare for a harder implementation stream with the **research-backed planning chain**:

```
internal research (/10x-research) + external research (exa.ai, Context7) -> /10x-plan -> /10x-implement -> success
```

The lesson focus is distinguishing internal from external research and using evidence to back planning decisions.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Internal research (lesson focus)** | |
| `/10x-research <change-id>` | You need evidence from the existing codebase — patterns, conventions, integration points, or existing implementations. Runs parallel sub-agents over the repo and writes structured findings to `research.md`. |
| **External research (lesson focus)** | |
| exa.ai | You need AI-native web search for library comparisons, best practices, or ecosystem context that the codebase cannot answer. |
| Context7 (`resolve-library-id` → `get-library-docs`) | You need live, current documentation for a specific library or framework. Resolves a library ID first, then fetches relevant doc pages. |
| **Framing spare wheel** | |
| `/10x-frame <change-id>` | The plan won't converge, the plan doesn't deliver expected results, or persistent drift keeps breaking the implementation. Use as an escape hatch on a separate problem (demonstrated on Space Explorers example), not as pre-research ritual. |
| **Planning and execution** | |
| `/10x-plan <change-id>` / `/10x-implement <change-id> phase <n>` | Use the same planning and execution chain from Lesson 2, now with upstream research evidence feeding the plan. |

### Research discipline

- Internal research (`/10x-research`) answers "what does our codebase already do?" — patterns, schemas, conventions, integration points.
- External research (exa.ai, Context7) answers "what should we do?" — library capabilities, API docs, ecosystem best practices.
- Combine both as evidence-backed input to `/10x-plan`. A plan without research evidence on a non-trivial stream is a guess.
- Agent-friendly docs (`llms.txt`, markdown-for-agents, `/md` endpoints) are a quality signal for library selection — libraries that publish agent-readable docs integrate faster.

### `/10x-frame` as spare wheel

Three triggers for reaching for `/10x-frame`:
1. The plan won't converge — research keeps opening more questions instead of narrowing to a contract.
2. The plan doesn't deliver — implementation repeatedly fails to meet success criteria.
3. Persistent drift — the implementation keeps diverging from the plan in ways that suggest the problem was mis-framed.

Demonstrated on a Space Explorers example, not the SRS path. It is an escape hatch, not a mandatory step.

### Paths used by this lesson

- `context/changes/<change-id>/research.md` - internal research output
- `context/changes/<change-id>/frame.md` - framing output when needed
- `context/changes/<change-id>/plan.md` - evidence-backed implementation contract
- `context/foundation/lessons.md` - recurring rules and pitfalls

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
