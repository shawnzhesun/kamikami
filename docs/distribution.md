# Distribution

The installed app runs everything itself: users install KamiKami, open it, and connect agent apps from **Assistant settings → Agent apps**. There's no Node, terminal or source checkout on their machine.

## What runs where

| | From source (`npm run desktop`) | Installed app |
| --- | --- | --- |
| Editor | Vite dev server on 5173 | Built editor (`dist/`), served by the service |
| Service | `tsx server/index.ts`, started by `concurrently` | `desktop-build/service.mjs` in an Electron utility process (`electron/service.cjs`), started and stopped with the app |
| Workspace | `.kamikami/` in the repo | `workspace/` in the app's user data folder (`~/Library/Application Support/KamiKami` on macOS) |
| Renders | Remotion bundles `src/render.tsx` with webpack on first use | Prebuilt `desktop-build/remotion/` |
| Headless browser, ffmpeg, ffprobe | Remotion's download cache, `ffmpeg-static`, `ffprobe-static` | Copies for the build platform in `desktop-build/` |
| MCP server | `node server/mcp.mjs` | `Resources/bin/kamikami-mcp` (`.cmd` on Windows): the app's executable with `ELECTRON_RUN_AS_NODE` running `desktop-build/mcp.mjs` |

`electron/runtime.cjs` decides the mode: `app.isPackaged`, or `KAMIKAMI_BUNDLED=1` to run a local `npm run build:desktop` with `electron .`. The service reads the packaged paths from environment variables (`packaged` in `server/service-config.ts`).

When an MCP client calls a tool and the app isn't running, the MCP server opens it (`launchApp` in `server/mcp-server.ts`) and waits for the editor to connect. Starting a client session never opens the app. The app holds a single-instance lock, so a second launch focuses the open window.

## Build

Requires Node 22+ (electron-builder needs it).

```sh
npm run dist       # editor, service, render bundle, then installers in release/
npm run dist:dir   # the same, but an unpacked app only (faster to test)
```

`npm run build:desktop` (`scripts/build-desktop.mjs`) writes `desktop-build/`: the service and MCP server bundled with esbuild, the Remotion bundle, Remotion's pinned headless browser, ffmpeg and ffprobe. `electron-builder.yml` lists what goes into the app.

- **Dependencies.** Only `dependencies` in `package.json` are copied into the app's `node_modules`. Keep that list to the packages the bundled service loads from disk at run time (today `@remotion/renderer`, which locates its native compositor, and its peer dependencies `react` and `react-dom`). Everything the editor or the service bundle includes is a dev dependency.
- **One platform per build.** The compositor, browser, ffmpeg and ffprobe are native binaries for the machine that builds. Build each target on its own OS and architecture, for example in a CI matrix (macOS arm64, macOS x64, Windows x64, Linux x64).
- **No asar.** ffmpeg, the compositor and the browser need real file paths, so the app ships as plain files.

### Test a build without touching your setup

```sh
ditto release/mac-arm64/KamiKami.app /tmp/kk-test/KamiKami.app
KAMIKAMI_PORT=4398 KAMIKAMI_USER_DATA=/tmp/kk-profile \
  /tmp/kk-test/KamiKami.app/Contents/MacOS/KamiKami
```

Test a copy outside the repo: inside it, Node finds missing packages in the repo's `node_modules`, so an app that lacks a dependency still works there and fails once installed. This uses its own port, profile and workspace. Point an MCP client at `Contents/Resources/bin/kamikami-mcp` with `KAMIKAMI_PORT=4398` in its environment. On macOS the launcher forwards `KAMIKAMI_*` variables to an app it opens.

## Signing

Unsigned builds work locally, but other Macs block them. On macOS, electron-builder signs with a Developer ID certificate from the keychain (or `CSC_LINK` / `CSC_KEY_PASSWORD`) and notarizes when `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID` (or an App Store Connect API key) are set. It signs every binary in the app, including the browser and ffmpeg, with `electron/entitlements.mac.plist`. Windows builds need a code-signing certificate (`CSC_LINK` / `CSC_KEY_PASSWORD`, or Azure Trusted Signing) to avoid SmartScreen warnings.

`CSC_IDENTITY_AUTO_DISCOVERY=false` skips signing for a quick local build.

## Before shipping

- **ffmpeg.** `ffmpeg-static` and `ffprobe-static` are GPL builds with nonfree parts and can't be redistributed in a closed app. Replace them with LGPL builds (for example your own `--disable-gpl --disable-nonfree` build) before shipping. Point `scripts/build-desktop.mjs` at those binaries; development can use `KAMIKAMI_FFMPEG` / `KAMIKAMI_FFPROBE`.
- **Remotion.** Check whether your organization needs a [company license](https://www.remotion.dev/docs/license/pricing).
- **Fonts.** Bundled fonts are SIL OFL; their notices ship in `public/fonts/LICENSES.txt`.
- **`RunAsNode` fuse.** The MCP launcher depends on Electron's `RunAsNode` fuse, so keep it enabled. The trade-off: any local process can run code as KamiKami (and inherit its macOS permissions). The alternative is a separate signed helper binary.
- **Port.** The service uses 4318, and MCP clients expect it there. A development copy that is already running blocks the installed app, which then says so at startup.
- **Updates.** There is no auto-update yet. electron-builder already writes `latest-mac.yml`, so [electron-updater](https://www.electron.build/auto-update) can be added once releases are published somewhere.
- **Windows and Linux.** Targets (NSIS, deb) and the `.cmd` launcher are configured but haven't been tested.
