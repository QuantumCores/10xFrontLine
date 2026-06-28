---
change_id: s-01-first-saved-frontline-match
topic: Phaser API research for S-01
status: researched
created: 2026-06-28
sources_checked: official Phaser docs, official Phaser Angular template
documentation_api_available: false
---

# Phaser API Docs for S-01

## Scope

This note captures external Phaser documentation relevant to `s-01-first-saved-frontline-match`, the first saved frontline match from `context/foundation/roadmap.md`.

The local mobile app is Angular 22 and does not currently list `phaser` in `src/mbl/package.json`. `context/foundation/tech-stack.md` names Phaser as the browser-first game-loop/game-UI library, so S-01 should add Phaser to the existing Angular app rather than replacing the app scaffold.

I did not find a Context7/documentation API tool available in this session. Research below uses official Phaser web docs and the official Phaser Angular template.

## Version Choice

Use Phaser 3 for S-01, specifically the current stable Phaser 3 API line documented as `v3.90.0`.

Reasoning:

- Official docs currently expose newer Phaser `v4.1.0`, but the official Angular template is explicitly a Phaser 3 template updated for Phaser `3.90.0`, Angular `19.2.0`, and TypeScript `5.7.2`.
- The repo already uses Angular 22 and TypeScript 6.0.2, so the template should be used as an integration reference, not copied wholesale.
- Phaser 3 docs include TypeScript definitions via the npm package. The docs say modern editors detect them through the package `types` entry.

Recommended dependency:

```powershell
cd src/mbl
npm install phaser
```

Sources:

- https://docs.phaser.io/phaser/getting-started/installation
- https://docs.phaser.io/api-documentation/3.90.0/api-documentation
- https://github.com/phaserjs/template-angular

## Angular Integration Pattern

The official Phaser Angular template provides the right ownership model:

- Keep Angular responsible for app shell, auth state, route guards, API calls, and result submission.
- Keep Phaser responsible for the match canvas, game loop, input, and immediate visual feedback.
- Add a bridge component similar to the template's `phaser-game.component.ts` that creates `new Phaser.Game(config)` and exposes the current game/scene to Angular when needed.
- Use an event bus or narrow callback interface for Angular <-> Phaser communication. For S-01, prefer a typed local adapter over broad global events:
  - Angular sends: start match, selected unit/action if using Angular controls, restart once S-04 arrives.
  - Phaser sends: match completed payload, visible state updates only if Angular renders surrounding UI.
- Destroy the Phaser game from Angular component teardown using `game.destroy(true, false)`.

The template's asset convention maps well to this repo:

- Put game assets under `src/mbl/public/assets`.
- Phaser can load them using paths like `assets/...`.
- Angular build copies public assets into the browser output.

Source:

- https://github.com/phaserjs/template-angular

## Required Phaser Concepts for S-01

### Game Instance

`Phaser.Game` is the main controller: it parses config, creates the renderer, sets up global systems such as input and sound, starts the Scene Manager, and begins the main loop.

Implementation notes:

- Instantiate exactly once per mounted Angular game component.
- Use a `parent` or `scale.parent` that points to a stable host element inside the Angular component.
- Prefer scene systems (`this.add`, `this.input`, `this.time`, `this.tweens`, `this.scale`) from within scenes instead of reaching through the global `Game` object.
- On Angular teardown, call `destroy(removeCanvas, noReturn)`. Use `removeCanvas: true`; leave `noReturn` false so another match/game instance can be created on the same page later.

Source:

- https://docs.phaser.io/api-documentation/3.90.0/class/game

### Scene Lifecycle

Scenes are the main home for game logic and game objects. Phaser scenes can define:

- `init()` for scene input data/setup.
- `preload()` for assets.
- `create()` for constructing objects and registering input/events.
- `update(time, delta)` for per-frame simulation while running.

Useful Scene systems documented on `Phaser.Scene`:

- `this.add`: create display objects.
- `this.input`: pointer/touch/mouse input.
- `this.time`: timers and delayed calls.
- `this.tweens`: simple animations.
- `this.scale`: sizing and coordinate handling.
- `this.registry`: global data manager if a later slice needs cross-scene shared state.

S-01 should likely need one `FrontlineMatchScene`, not multiple scenes. A single scene is enough for the first playable proof: create board/lane, render units/frontline/HUD text, tick NPC actions, detect end, emit result.

Source:

- https://docs.phaser.io/api-documentation/3.90.0/class/scene

### Scale and Mobile Canvas

Phaser's Scale Manager handles canvas scaling. For S-01:

- Use a fixed logical game size, for example portrait-oriented `390x844` or another chosen design size.
- Use `Phaser.Scale.FIT` so the canvas fits the available Angular host while preserving game coordinates.
- Set `scale.parent` to the game host element ID or pass `parent` in the game config.
- Use `autoCenter` if the canvas should be centered in the host.
- Avoid `RESIZE` for S-01 unless the scene code is explicitly written to re-layout all objects. `FIT` is simpler and enough for a mobile-first MVP.

Angular-specific input warning from Phaser docs:

- If Angular routing or conditional rendering changes the Phaser component's DOM visibility/state, call `this.scale.updateBounds()` after the scene/component is visible. Phaser docs explicitly call this out for incorrect input coordinates with Angular.

Source:

- https://docs.phaser.io/api-documentation/3.90.0/class/scale-scalemanager
- https://docs.phaser.io/api-documentation/3.90.0/class/input-inputplugin

### Input

`this.input` belongs to a Scene and handles input events. The docs show two useful patterns:

```ts
this.input.on('pointerdown', callback, context);
```

for canvas-level input, and:

```ts
const sprite = this.add.sprite(x, y, texture);
sprite.setInteractive();
sprite.on('pointerdown', callback, context);
```

for object-level input.

For S-01:

- Create the three unit choice buttons as Phaser objects if the whole match UI lives in the canvas.
- Use `setInteractive()` on rectangular button zones or shapes.
- Use `pointerdown` for mobile/touch-first actions.
- Keep the game rules deterministic and call plain TypeScript methods from input handlers; avoid putting rule calculations directly into event callbacks.
- Use `this.input.enableDebug(gameObject)` during development if hit areas feel wrong, but do not ship visible debug shapes.

Source:

- https://docs.phaser.io/api-documentation/3.90.0/class/input-inputplugin

### Primitive Rendering for MVP UI

S-01 does not need a sprite pipeline to prove the match loop. Phaser can render the first vertical slice with primitives:

- `this.add.rectangle(...)` creates fill/stroke-capable rectangle shapes and can be tweened, scaled, made interactive, or used with physics.
- `this.add.graphics(...)` creates a Graphics object for custom lane/frontline drawings.
- `this.add.text(...)` plus `setText(...)` is enough for counters, unit labels, result copy, and basic status.

Good first-pass S-01 rendering:

- Lane/frontline: one track rectangle, center line, moving frontline marker.
- Unit pressure: simple colored blocks or tokens moving/stacking near the line.
- Unit choices: three bottom buttons with text labels and disabled/cooldown/progress styling.
- Outcome: overlay text for win/loss and "saving/saved/failed" state if Angular does not render that outside Phaser.

Sources:

- https://docs.phaser.io/api-documentation/3.90.0/class/gameobjects-gameobjectfactory
- https://docs.phaser.io/api-documentation/3.90.0/class/gameobjects-graphics
- https://docs.phaser.io/api-documentation/3.90.0/class/gameobjects-text

### Timers and Simulation

`this.time` is a Scene Clock. It supports:

- `addEvent(config)` to create a timer event.
- `delayedCall(delay, callback, args, callbackScope)` as a shortcut.
- `timeScale` for scaling Scene clock time.

For S-01, either approach is acceptable:

- Use `update(time, delta)` for continuous pressure/frontline movement.
- Use `this.time.addEvent({ delay, loop: true, callback })` for discrete NPC actions, unit production ticks, or periodic scoring.

Recommendation:

- Keep the rules in a pure/mostly pure TypeScript match engine that accepts elapsed time or command events.
- Let Phaser scene call `engine.step(delta)` in `update`.
- Use Phaser timers only for visual/UI cadence or if the engine itself is intentionally tick-based.

Source:

- https://docs.phaser.io/api-documentation/3.90.0/class/time-clock

### Tweens

Tweens alter object properties over time. The docs show `this.tweens.add({ targets, x, ease, duration })`; playback starts immediately unless configured paused. Tweens are intended as "fire-and-forget" and auto-destroy when complete unless `persist` is set.

For S-01:

- Use tweens for visible movement/feedback only: frontline marker easing, button press feedback, unit token arrival.
- Do not make tween completion the source of game truth. The engine state should decide match result, not animation timing.
- Avoid persisted tweens unless there is a real need, because persistent tweens must be destroyed manually.

Source:

- https://docs.phaser.io/api-documentation/3.90.0/class/tweens-tweenmanager

## Suggested S-01 Phaser File Shape

Fit this into the existing Angular app instead of copying the Phaser template:

```text
src/mbl/src/app/
  game/
    phaser-game.component.ts
    phaser-game.component.html
    phaser-game.component.scss
    frontend-match.scene.ts
    match-engine.ts
    match-types.ts
```

Possible responsibility split:

- `phaser-game.component.ts`: Angular host, creates/destroys Phaser game, receives completion event, calls API/client service to save result.
- `frontend-match.scene.ts`: Phaser Scene only: draws board, listens for input, advances visuals, emits completed match.
- `match-engine.ts`: deterministic rules: unit build, NPC actions, frontline pressure, win/loss, result payload.
- `match-types.ts`: shared TypeScript types for commands, state snapshots, completion payload.

If the implementation plan later creates a route/component for the match page, the Phaser host component should be embedded there rather than becoming the app root.

## Game Config Sketch

```ts
import Phaser from 'phaser';
import { FrontlineMatchScene } from './frontline-match.scene';

export const createFrontlineGameConfig = (
  parent: HTMLElement,
  onComplete: (result: CompletedMatchResult) => void,
): Phaser.Types.Core.GameConfig => ({
  type: Phaser.AUTO,
  parent,
  backgroundColor: '#101820',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 390,
    height: 844,
  },
  scene: [new FrontlineMatchScene({ onComplete })],
});
```

Notes:

- The scene constructor callback pattern is one option. If TypeScript or Phaser scene restart semantics make that awkward, pass data through `scene.start(key, data)` or a small typed event bus.
- Use Phaser's `AUTO` renderer unless a later device test shows WebGL/Canvas needs to be forced.
- Add `this.scale.updateBounds()` when the Angular component becomes visible or after route-driven layout changes.

## Risks and Implementation Warnings

- Phaser v4 docs are latest, but S-01 should not mix v4 API assumptions into a Phaser 3 integration unless the project deliberately chooses Phaser 4. The official Angular template still targets Phaser 3.90.0.
- Angular lifecycle matters: failing to destroy `Phaser.Game` on component teardown can leave canvases, input listeners, and animation loops alive.
- Input coordinates can be wrong after Angular DOM/router changes unless `scale.updateBounds()` is called.
- `FIT` keeps a stable coordinate system. `RESIZE` sounds attractive for responsive UI but pushes more layout work into the scene.
- Keep persistence outside Phaser. Phaser should emit a completed result; Angular/API code should save it. This keeps S-03 offline/result sync work separable later.
- Keep game-rule state independent from rendering/tweens so S-01 can be unit-tested without launching a canvas.

## Source Index

- Phaser 3 getting started tutorial: https://phaser.io/tutorials/getting-started-phaser3
- Phaser "What is Phaser?": https://docs.phaser.io/phaser/getting-started/what-is-phaser
- Phaser installation and TypeScript definitions: https://docs.phaser.io/phaser/getting-started/installation
- Phaser working with local server/dev setup: https://docs.phaser.io/phaser/getting-started/set-up-dev-environment
- Phaser project templates: https://docs.phaser.io/phaser/getting-started/project-templates
- Phaser first game tutorial: https://docs.phaser.io/phaser/getting-started/making-your-first-phaser-game
- Phaser 3.90.0 API docs root: https://docs.phaser.io/api-documentation/3.90.0/api-documentation
- Phaser 3.90.0 `Game`: https://docs.phaser.io/api-documentation/3.90.0/class/game
- Phaser 3.90.0 `Scene`: https://docs.phaser.io/api-documentation/3.90.0/class/scene
- Phaser 3.90.0 `ScaleManager`: https://docs.phaser.io/api-documentation/3.90.0/class/scale-scalemanager
- Phaser 3.90.0 `InputPlugin`: https://docs.phaser.io/api-documentation/3.90.0/class/input-inputplugin
- Phaser 3.90.0 `GameObjectFactory`: https://docs.phaser.io/api-documentation/3.90.0/class/gameobjects-gameobjectfactory
- Phaser 3.90.0 `Graphics`: https://docs.phaser.io/api-documentation/3.90.0/class/gameobjects-graphics
- Phaser 3.90.0 `Text`: https://docs.phaser.io/api-documentation/3.90.0/class/gameobjects-text
- Phaser 3.90.0 `Clock`: https://docs.phaser.io/api-documentation/3.90.0/class/time-clock
- Phaser 3.90.0 `TweenManager`: https://docs.phaser.io/api-documentation/3.90.0/class/tweens-tweenmanager
- Official Phaser Angular template: https://github.com/phaserjs/template-angular
