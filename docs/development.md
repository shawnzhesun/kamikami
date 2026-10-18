# Development

KamiKami is Electron + React/TypeScript + Remotion: a local editor, a local service, and an MCP server for agents. Coding agents should start with [AGENTS.md](../AGENTS.md).

## Run

Requires Node 22+.

```sh
npm install
npm run desktop   # Electron app (dev launcher, not an installer)
npm run dev       # or: browser at http://127.0.0.1:5173
```

Both start the local service on port 4318; run only one. The service restarts on source changes. After changes to `electron/`, or to effect schemas or engines, fully quit and restart the app.

`npm run dist` builds an installer in `release/` that runs the service itself and ships an MCP launcher, so users need no Node. See [distribution.md](distribution.md).

## Checks

| Command | Checks | Touches your workspace? |
| --- | --- | --- |
| `npm test` | Unit tests (`tests/*.test.ts`) | No |
| `npm run build` | `tsc` and Vite build | No |
| `npm run test:ui`, `test:ui:keyframes` | Editor in Chromium against an isolated fixture (port 5174) | No |
| `npm run test:text-render`, `test:kinetic-render` | Rendered text frames in a temp dir | No |
| `npm run test:e2e` | A whole music video built through a real MCP client, on its own ports and workspace | No |
| `npm run test:service` | Local service, import and export | **Yes**: writes test assets and an export to `.kamikami` |
| `npm run test:mcp`, `test:mcp:full` | MCP edits through the running editor | **Yes**: edits the open project, then undoes (`:full` leaves imports, effects and exports) |

## Docs

| Doc | Covers |
| --- | --- |
| [AGENTS.md](../AGENTS.md) | Start here if you are a coding agent: code map, conventions, how to add effects, rules |
| [project.md](project.md) | Project model, versions, effect instances, keyframes, storage, limits |
| [editor.md](editor.md) | Editor UI, shortcuts, fonts, shapes, backdrops, media |
| [effects.md](effects.md) | Effect recipes, engines, roles, library, presets, bundles |
| [text-effects.md](text-effects.md) | Title animations, kinetic type, text treatments, kinetic layouts |
| [visual-effects.md](visual-effects.md) | Channels, curves, passes, depth, particles, artwork treatments |
| [overlays.md](overlays.md) | The overlay engine: placement, timing and shared styles |
| [assistant.md](assistant.md) | Native assistant, MCP for Claude Code / Codex, tools and rules |
| [media-analysis.md](media-analysis.md) | Probing, AI analysis, transcripts, metadata, editing tools |
| [distribution.md](distribution.md) | Installer builds, the bundled service and MCP launcher, signing, releases, shipping checklist |
| [roadmap.md](roadmap.md) | Known gaps, next features, third-party sources and licenses |

## Landing page

The website is plain HTML in `site/`, published to GitHub Pages by `.github/workflows/pages.yml` on every push to `main` that changes it. Open `site/index.html` in a browser to preview it. Its download button points at the latest GitHub release (see [distribution.md](distribution.md#releases)).

## Security model

The local service trusts loopback only (host and origin checks plus a custom header). It is not a deployable backend.
