# AGENTS.md

How to work on KamiKami's code. This file is for coding agents. To edit a *video project* through the app, read the [editing skill](.agents/skills/kamikami-editor/SKILL.md) instead.

## Code map

| Area | Files |
| --- | --- |
| Project schema, limits, migration | `src/model.ts` (`ProjectSchema`, `LIMITS`, `validateProject`), `src/effect-instance.ts`, `src/keyframes.ts`, `src/history.ts` |
| Rendering (preview = export) | `src/Composition.tsx`, `src/AnimatedText.tsx` (text), `src/ArtworkLayer.tsx` (pictures), `src/*GraphicEffects.tsx` (passes), `src/OverlayLayer.tsx`, `src/BackdropArt.tsx`, `src/FontText.tsx` |
| Effect engines | `src/visual-effects.ts` (passes, engine ladder), `src/text-effects.ts`, `src/title-effects.ts`, `src/kinetic-type.ts`, `src/text-looks.ts`, `src/text-layouts.ts`, `src/artwork.ts`, `src/motion.ts`, `src/backdrops.ts`, `src/shapes.ts` |
| Overlays | `src/overlays.ts` (schema, dispatcher), `src/overlay-kinds/*.ts` (one file per section), `src/overlay-kit.ts`, `src/overlay-style.ts`, `src/overlay-cards.ts` |
| Effect library | `src/builtin-effects.ts` (cards, families), `src/effect-roles.ts` (role, feel, target), `src/effect-bundle.ts` (apply, bundles, `effectEngine`), `src/effect-catalog.ts` (agent search and describe) |
| Editor UI | `src/App.tsx` (state, history, autosave, agent commands), `src/editor/*` (timeline, canvas, dialogs, controls, `editing.ts` for ripple/edit-list operations, `tracks.ts`) |
| Agent tools | `server/editor-tools.ts` (the one tool list), `server/tool-runner.ts` (the one dispatcher), `server/agent-conventions.ts` (rules every agent gets), `src/agent-protocol.ts` (validated editor commands, revisions), `server/editor-bridge.ts` |
| Service | `server/index.ts` (endpoints, storage, renders, capabilities), `server/service-config.ts` (ports, workspace), `server/assistant.ts`, `server/assistant-model.ts`, `server/mcp.mjs` → `server/mcp-server.ts`, `server/media-library.ts`, `server/effect-library.ts`, `server/font-library.ts`, `server/analysis/*` |
| Desktop shell | `electron/main.cjs` (sandboxed window), `electron/runtime.cjs` (development or installed origins), `electron/service.cjs` (runs the built service), `electron/bin/` (MCP launchers), `electron/preload.cjs`, `electron/project-files.cjs`, `electron/assistant-credentials.cjs` |
| Installer | `scripts/build-desktop.mjs` (service, MCP, render bundle, browser, ffmpeg into `desktop-build/`), `electron-builder.yml`; see [docs/distribution.md](docs/distribution.md) |

## Conventions

- **Resolution independence.** Any fixed pixel amount in rendering is a reference pixel: multiply by `frameUnit(frame)` (short side / 1080). Never divide by the frame width alone, and never assume 1920×1080. `tests/resolution.test.ts` covers the rule.
- **Playback cost.** Chrome rasterizes every `feImage` again whenever its filter, or anything under it, changes (another effect, a keyframe), so a full-frame generated image costs 20–100 ms per played frame, even a static one. Use no image where primitives do it (`feFlood` regions for bars and slats, `feOffset` for moved copies); keep repeating content to a small whole-pixel cell with `feTile` (`screenCell`); draw smooth content (gradients, linear sampling maps) as a tiny stretched PNG (`stretchedImage`, `affineAlphaMaps` in `src/graphic-maps.ts`); draw small marks as images sized to each mark. Never copy an element to cut it up: copies repeat all of its effects. Leave out neutral CSS filters and 3D transform functions: each makes the element a compositing layer.
- **Determinism.** Every effect is a pure function of the frame, settings and seed. No `Math.random()`, `Date.now()` or browser state in rendering; use `effectRandom(seed, n)`. Previews and exports must draw the same frame.
- **Schemas are the contract.** Zod schemas in `src/` validate projects, effects, bundles and agent commands. New effect fields need defaults, so older saved data still parses.
- **Engine gating.** A recipe's minimum engine is computed by `effectEngine` (`src/effect-bundle.ts`) from the `usesV*Features` checks in `src/visual-effects.ts`. A new field or kind must be added to the right check. The ladder is `effectEngines`; the last entry is the current engine.
- **Migrations.** Never break saved projects or bundles. Convert old shapes in `validateProject` or the bundle preprocess; see `migrateLegacyDecor` in `src/overlays.ts`.
- **Effects are declarative.** No `eval`, user code, shaders or plugins.
- **Text rules.** Text-only effects (`effect.text`) and picture-only effects (artwork `trail`/`slices`) are enforced by `targetMismatch` (`src/effect-roles.ts`) and `applyEffectToLayers`.
- **Values live in code.** Docs and tool descriptions don't restate counts, kind lists or ranges; they name the source (`LIMITS`, `overlayKinds`, a schema) or the tool that reports it (`get_capabilities`, `find_effects`, `describe_effect`).
- **Style.** Match surrounding code. Prettier (`npm run format`). Comments explain why, not what.
- **Original work.** Reimplement from observed technique; don't copy code from studied projects (see the license notes in [docs/roadmap.md](docs/roadmap.md#third-party-sources)).

## Adding things

- **An overlay kind:**
  1. Add the name to `overlayKinds` in `src/overlays.ts`.
  2. Add a `KindSpec` (name, feel, description, defaults, controls, variants, `draw`) in the matching `src/overlay-kinds/*.ts` file.
  3. Add a card with 3–5 variations in `src/overlay-cards.ts`.

  `tests/overlays.test.ts` renders every variation and checks for finite values and unique keys.
- **A pack-only kind** (a style that ships as an effect pack, not built-in cards): add it to `packOnlyPassKinds` or `packOnlyOverlayKinds` instead of adding a card, gate it in a new engine, and build its presets as a pack in `examples/effects/`. The built-in library must not duplicate it.
- **A text or kinetic kind:**
  1. Add the kind list, names and controls in its engine file.
  2. Add the render logic.
  3. Add a role and feel in `src/effect-roles.ts`.
  4. Add a card in `src/builtin-effects.ts`.

  Entrances get a reversed `-out` card automatically.
- **A card or variation:** use `src/builtin-effects.ts` or `src/overlay-cards.ts`. IDs must be unique across the whole library; existing IDs never change, because projects reference them.
- **An agent tool:**
  1. Add the definition to `server/editor-tools.ts` with its `access` (`read`, `add` or `edit`). Take enums and limits from the source schemas instead of writing values into the description.
  2. Editor tools: add a command with the same parameters to `src/agent-protocol.ts` and handle it in `src/App.tsx`. Service tools: add a case to `runTool` in `server/tool-runner.ts` and list it in `serviceTools` in `tests/agent-tools.test.ts`.

  Both transports pick it up; there's no per-transport routing, count or doc table to update.

## Testing rules

- Run `npm test` and `npm run build` for every change. Run `test:ui` for editor UI changes. Run `test:kinetic-render` / `test:text-render` for rendering changes.
- **Do not run `test:service`, `test:mcp` or `test:mcp:full` unprompted.** They edit the user's live workspace.
- `npm run test:e2e` is safe: it starts its own service, editor and browser on separate ports with a temporary workspace, creates a project as a user, then builds and exports a music video through a real MCP client. Run it after agent-tool or editor-command changes.
- For visual checks, render contact sheets to a scratch directory with Remotion's `openBrowser`; never write into `.kamikami/`.
- `.kamikami/` is the user's workspace (project, media, effects, analysis). Tests and scripts must not write to it.
- After changes to `electron/`, `server/service-config.ts`, the MCP launcher or `electron-builder.yml`, run `npm run dist:dir` (Node 22+) and copy `release/mac-arm64/KamiKami.app` to a scratch folder outside the repo (inside it, Node resolves missing packages from the repo's `node_modules` and hides packaging gaps), then start it with `KAMIKAMI_PORT` and `KAMIKAMI_USER_DATA` set to a scratch port and folder, so it doesn't touch the user's profile.

## Gotchas

- `dependencies` in `package.json` is what ships in the installed app's `node_modules`; everything bundled (editor libraries, the service's pure-JS packages) is a dev dependency. Add a runtime dependency only if the bundled service must load it from disk, together with its peer dependencies (`@remotion/renderer` needs `react` and `react-dom`).
- Video clips render through `OffthreadVideo`. A `<Video>` element seeks per frame, and in multi-tab GPU exports it sometimes shows a neighbouring frame, which makes clips stutter.
- **Preview render cache.** The editor plays cached chunks rendered by the export pipeline (`server/preview-cache.ts`), keyed by `chunkKeys` in `src/preview-cache.ts`. The key covers the visible elements in each chunk, the effects they use, missing media, fonts, the frame setup and the engine version. Anything new that changes how a frame draws must reach that key, or the editor plays stale frames. The frames are session data: the service deletes its folder on exit, and the next start deletes folders left by crashed services.
- **ffmpeg.** The installed app's ffmpeg is an LGPL build from `scripts/build-ffmpeg.mjs`, not `ffmpeg-static`. A new filter, encoder or muxer in `server/analysis/` must be added to `required` there (and to the build flags if it needs an external library), or packaged builds fail or lack it. Never add GPL or nonfree parts.
- The Electron app and the service cache schemas. After engine or schema changes, the desktop app needs a full restart.
- MCP clients start `server/mcp.mjs` once; restart the MCP server (or the client) after changing tool definitions. It loads TypeScript through `tsx`, so it must not print to stdout.
- `project.layers` holds **elements**; timeline rows are `project.tracks`. Tool parameters named `layerId` refer to elements.
- Each element holds at most `LIMITS.elementEffects` effects; validation errors are turned into readable sentences in `validateProject`.
- Card IDs can differ from their kind: `kinetic-roll` uses kind `wheel`, and `kinetic-burst` uses kind `blast` (`burst` is a text look).
- The overlay kits (Rough.js, perfect-freehand) expect pixel-sized coordinates; `src/overlay-style.ts` scales paths up and back.
