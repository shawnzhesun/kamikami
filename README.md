# KamiKami

A local video editor for lyric videos and motion graphics: a layered timeline, a library of deterministic effects, media analysis, and a built-in AI editing assistant. Electron + React/TypeScript + Remotion. Single user, local only.

## Run

Requires Node 22+.

```sh
npm install
npm run desktop   # Electron app (dev launcher, not an installer)
npm run dev       # or: browser at http://127.0.0.1:5173
```

Both start the local service on port 4318; run only one. The service restarts on source changes. After changes to `electron/`, or to effect schemas or engines, fully quit and restart the app.

`npm run dist` builds an installer in `release/` that runs the service itself and ships an MCP launcher, so users need no Node. See [docs/distribution.md](docs/distribution.md).

## Checks

| Command | Checks | Touches your workspace? |
| --- | --- | --- |
| `npm test` | Unit tests (`tests/*.test.ts`) | No |
| `npm run build` | `tsc` and Vite build | No |
| `npm run test:ui`, `test:ui:keyframes` | Editor in Chromium against an isolated fixture (port 5174) | No |
| `npm run test:text-render`, `test:kinetic-render` | Rendered text frames in a temp dir | No |
| `npm run test:service` | Local service, import and export | **Yes**: writes test assets and an export to `.kamikami` |
| `npm run test:mcp`, `test:mcp:full` | MCP edits through the running editor | **Yes**: edits the open project, then undoes (`:full` leaves imports, effects and exports) |

## Docs

| Doc | Covers |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Start here if you are a coding agent: code map, conventions, how to add effects, rules |
| [docs/project.md](docs/project.md) | Project model, versions, effect instances, keyframes, storage, limits |
| [docs/editor.md](docs/editor.md) | Editor UI, shortcuts, fonts, shapes, backdrops, media |
| [docs/effects.md](docs/effects.md) | Effect recipes, engines, roles, library, presets, bundles |
| [docs/text-effects.md](docs/text-effects.md) | Title animations, kinetic type, text treatments, kinetic layouts |
| [docs/visual-effects.md](docs/visual-effects.md) | Channels, curves, passes, depth, particles, artwork treatments |
| [docs/overlays.md](docs/overlays.md) | The overlay engine: placement, timing and shared styles |
| [docs/assistant.md](docs/assistant.md) | Native assistant, MCP for Claude Code / Codex, tools and rules |
| [docs/media-analysis.md](docs/media-analysis.md) | Probing, AI analysis, transcripts, metadata, editing tools |
| [docs/distribution.md](docs/distribution.md) | Installer builds, the bundled service and MCP launcher, signing, shipping checklist |
| [docs/roadmap.md](docs/roadmap.md) | Known gaps, next features, third-party sources and licenses |

## Before distributing

See the full checklist in [docs/distribution.md](docs/distribution.md#before-shipping).

- The bundled `ffmpeg-static` is GPL with nonfree parts; replace it (override with `KAMIKAMI_FFMPEG` / `KAMIKAMI_FFPROBE`).
- Review the [Remotion license](https://www.remotion.dev/docs/license/pricing).
- Bundled fonts are SIL OFL; notices are in `public/fonts/LICENSES.txt`.
- The local service trusts loopback only (host/origin checks plus a custom header). It is not a deployable backend.
