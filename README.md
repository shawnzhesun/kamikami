# KamiKami

A local video-editor prototype with a layered timeline, deterministic effects, and a native editing assistant. Electron shell + React/TypeScript + Remotion. The included station artwork is original SVG created for this prototype.

## Run

Requires Node 22+ and npm.

```sh
npm install
npm run desktop
```

Or run `npm run dev` and open `http://127.0.0.1:5173` in a browser. Both commands start the local service on port 4318. Run only one of them at a time. `desktop` is a development launcher, not yet a distributable app installer.

## Native assistant

Open **Assistant**, choose **Connect assistant**, and enter a connection name, base URL, API key and model/deployment. OpenAI and LiteLLM/OpenAI-compatible proxies are supported. Choose Responses or Chat Completions to match the endpoint and model. **Load models** retrieves model aliases from the saved connection. Requests run inside the app; no terminal or external agent is required. Electron encrypts saved credentials with the OS-backed secure storage when available. Browser mode holds the key only in the local service's memory. `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`, `OPENAI_CONNECTION_NAME` and `OPENAI_API_MODE` (`responses` or `chat`) are also supported when launching the service. API access is billed by the provider; there is no KamiKami account or bundled subscription yet.

The assistant receives the current composition, selected clips and playhead. It can edit text, transforms, timing, layers, media and effects, inspect rendered frames, save portable effects, and export video. Attach media with the paperclip; it is copied into the library before sending. The model cannot browse arbitrary files on your computer. Messages, project details, library metadata and requested PNG previews are sent to the model; source videos/audio are not uploaded to the model by this integration.

Conversation history is saved locally. Steps and preview images appear beside the reply. **Stop** aborts model work and prevents new actions; an already-started editor operation settles first. Consecutive project edits from one request share an Undo step. Manual edits start a separate step; **Undo edits** only appears while that request owns the latest undoable edit. Saved user effects, imported assets and export files are separate library artifacts, not project Undo entries. Destructive clip removal and composition shortening show a confirmation in the panel.

Codex/Claude Code integration remains available as an advanced option through the same tool definitions and editor bridge. See [MCP setup and capabilities](docs/mcp.md). The primary app panel now contains the native assistant instead of MCP instructions.

## First session

1. Play or scrub the original 15-second sample composition.
2. Select an element on the canvas or timeline to open Inspector. Transform, trim, or edit its content and effects. Layers are independent timeline rows: create them with **New layer**, rename them with their settings button, and drag elements between them. Numeric changes apply on Enter or blur; invalid entries remain visible with an explanation, and Escape restores the saved field value. Continuous typing in one field is a single undo step.
3. Open Effects. Hover a sample graphic to preview the actual effect, or use its Play/Stop control. Drag a recipe onto a timeline clip, then click the applied effect name to jump to its shared definition. The editor shows how many layers use the effect. Visual effects and transforms are unavailable for audio layers.
4. Open Media to import, search, preview, and reuse images/video/audio. Drag an asset onto a timeline layer at the desired time; importing to the library alone does not change the composition. Imports are copied into the local workspace. Browser codec support determines which source formats preview correctly; MP4/H.264 and standard image formats are recommended for this prototype.
5. Open Assistant and describe an edit. Watch the canvas and timeline update, review the action log, and use Undo edits to reverse the latest assistant edits.
6. Export video. The first export can download Remotion's local Chromium renderer; progress is shown and an MP4 download becomes available.

## Editing safeguards and appearance

- Shortening the composition lists affected clips and their before/after timing before you choose whether to trim them. Cancel preserves the project; a single Undo restores a confirmed change.
- Drag clips to see their destination time before release. Escape cancels a drag. The timeline ruler supports click/drag scrubbing, arrow keys for one-frame steps, Shift+arrows for one-second steps, and Home/End.
- Click the project name in the header to open the project settings dialog. The preview fits its window automatically.
- The header palette button opens four app themes: Original, Olive, Daylight, and Dusk. Each option shows its four palette colors; changes apply immediately and persist across reloads. Project artwork and effect colors remain independent of the app theme. Selected cards use a full background fill without left-edge accents.
- Drag the divider beside the library to resize it. Width persists across reloads; double-click resets it. Media includes import, Open project, Download project JSON, delete and trash recovery controls. Add text from the Timeline toolbar.

## Canvas, timeline, and media tools

- **Canvas:** click a visible layer, then drag to move. Shift-click toggles multi-selection. Drag corners for proportional scale or the round handle to rotate; Shift snaps rotation to 15° steps. Arrow keys nudge by one composition pixel, Shift+arrows by ten. Center buttons align selected visible layers. Snapping uses canvas and layer centers; Alt bypasses it. Double-click text, then Apply or Cmd/Ctrl+Enter; Escape cancels.
- **Timeline:** drag the grip beside a layer name up/down to reorder the stack; Up/Down on a focused grip also moves it. Drag clips to move the selected group. Shift-click selects several; labels also accept Cmd/Ctrl-click. Drag either edge to trim, or focus an edge and use Left/Right (one frame, Shift for one second). Split cuts selected clips at the playhead, with at least three frames on each side. Zoom ranges from 1× to 8×; the factor button fits the timeline. Snap targets include clip boundaries and the playhead. Alt bypasses snapping. Each drag is one Undo step; Escape cancels it.
- **Media:** source duration/dimensions and waveforms persist between sessions. Source details are read on import; timed sources with missing metadata are inspected when added. Waveform decoding is limited to sources up to 32 MB and ten minutes; larger sources still support metadata and playback. Codec support determines whether previews/waveforms are available. Waveforms summarize the first audio channel.
- **Sound and recovery:** timeline and Inspector mute/solo controls apply to both audio and video layers. A soloed visible layer silences other audio/video layers. Refresh Media (or return to the app) to check missing sources. Relink replaces all project references in one undoable edit; replacement type must match and duration must cover every referenced clip. Missing visuals show a recovery placeholder.
- **Effects:** compact cards drag onto timeline clips; double-click inspects a definition and Enter applies to selected visual layers. Save snapshots to My effects or export/import portable effect bundles. Previews run six-second loops using the same curve evaluator as the composition. Hover/focus starts playback; explicit Play/Stop is available. Reduced-motion users opt in with Play. Trim and split preserve animation continuity using effect offsets and the original effect duration.

See [the completed usability plan](docs/usability-plan.md) and [proposed next features](docs/feature-proposals.md).

## Storage

`.kamikami/project.json` is the current autosaved project. `.kamikami/media/` holds imported copies, and `.kamikami/library.json` persists their names and metadata. `.kamikami/exports/` holds rendered videos and agent-review PNG frames. `.kamikami/effects.json` stores reusable user effects. Deleted media is hidden in Media trash with its source bytes retained for recovery. `.kamikami/assistant.json` stores local conversations and connection metadata (never the API key). All workspace data is gitignored. Project writes use atomic rename. Header Save explicitly flushes the current snapshot. Download project JSON creates an extra project backup; it references the local media library and does not embed media. Opening JSON imports the project into this workspace and autosaves it. Undo history is in memory and resets on reload.

Keep the entire `.kamikami` directory to preserve media when moving this prototype. There is currently one active project per workspace. Rendering is local, at 1920×1080/24fps, with one export at a time. Long projects may be slow; start with short scenes.

## Architecture

- `src/model.ts`: backward-compatible project schema, independent timeline layers and elements, reusable effect definitions, deterministic curve evaluation.
- `src/Composition.tsx`: shared Remotion composition for preview and MP4 rendering.
- `src/App.tsx`: manual editing, history, autosave, live agent edits, timeline, inspector.
- `src/editor/`: canvas, timeline, media library UI, settings dialogs, effect samples, and pure editing operations. `tracks.ts` handles layer membership, insertion, ordering and deletion.
- `server/index.ts`: local media import/storage, editor session bridge, render jobs.
- `server/assistant.ts`: native conversation lifecycle, tool execution, confirmation, cancellation and history.
- `server/assistant-model.ts`: streamed Responses and Chat Completions adapters, including tool history and image conversion for compatible proxies.
- `server/editor-tools.mjs`: shared tool catalog for native and external agents.
- `server/mcp.mjs`: optional stdio MCP transport and editing-skill resource.
- `server/editor-bridge.ts`: connected clients, command delivery, timeouts and editor ownership.
- `src/agent-protocol.ts`: validated edits and revision-based conflict protection.
- `server/media-library.ts`: persistent media catalog and missing-source checks.
- `electron/main.cjs`: sandboxed Electron window; no Node access in the renderer.
- `electron/assistant-credentials.cjs`: narrow credential IPC and encrypted local storage.

Effects currently use a declarative SDK: additive x/y/rotation/blur channels; multiplicative scale/opacity/brightness; linear/ease/sine/pulse curves; and a color wash on non-text layers. Timing is derived from the local clip frame. No `eval`, arbitrary agent code, filesystem plugins, or GPU shaders. Color wash covers the layer rectangle, not an image alpha silhouette.

## Deliberate limits and next iterations

- No arbitrary TypeScript effect compilation yet. First prove the schema-based create/preview/tweak/export loop; then add an isolated plugin worker with explicit capabilities.
- No freeform keyframe editor yet; motion controls are reusable curve channels. Add a keyframe graph/editor next.
- No beat detection, lyric alignment, or AI image generation yet. Agents can inspect rendered PNG frames; motion/audio review still requires playback.
- No cloud hosting, accounts, marketplace, or collaboration.
- Initial hard limits: 10-minute compositions, 40 layers/effects, 500 MB per import.
- Local endpoints enforce loopback host/origin and a custom mutation header. This is a single-user development service, not a remotely deployable backend.
- Review Remotion licensing before commercial deployment: https://www.remotion.dev/docs/license/pricing

## Checks

```sh
npm test
npm run build
npm run test:ui
```

`npm run test:ui` runs an isolated Chromium editor fixture on port 5174. It checks dialogs, media drops, multiple elements per layer, cross-layer moves, effects, Undo/Redo and reload, without reading or writing your workspace or calling a model.

With the app running, `npm run test:service` additionally checks local request validation, imports a small generated image and tone, and exports/downloads a one-second video. It creates test assets and an export in `.kamikami`, but does not overwrite the active project or make model API calls.

With the editor open and no active field/gesture, `npm run test:mcp` exercises live MCP reads, edits, effects, ordering, selection, seeking, saving, revision conflicts, and Undo/Redo. It restores its own changes; avoid manual edits while it runs.

Verified October 6, 2026: 31 regression tests, TypeScript/Vite build, skill validation, and MCP editing/media/render/export checks. Desktop QA covered compact effect dragging and Undo, media deletion Cancel/Confirm/Undo, library resizing, layer ordering, and session status. A real Claude Code session created, applied, visually inspected, saved and exported Retro title sway, then restored the composition. Codex setup follows official documentation; a Codex model session has not been exercised.

## User effects and comprehensive agent verification

Agents can author effects through a schema, preview them on live clips, inspect rendered frames, and save reusable snapshots. Share `.kamikami-effect.json` files containing the recipe, author, sharing terms and compatibility version. Import them from Effects, then drag onto a visual clip. No executable plugin installation is required.

See [the capability audit](docs/mcp-audit.md) for the 37-tool editing map, test coverage and limits. Run `npm run test:mcp:full` with the editor open to exercise the complete workflow.

### Rename compatibility

The app is now **KamiKami**. Existing local workspace data moves from `.frameforge` to `.kamikami` automatically when needed. Existing desktop installations reuse their previous Electron profile so saved assistant credentials and preferences remain available. Version-1 effect bundles retain the `frameforge-effect` / `frameforge-curves-v1` wire identifiers for compatibility; both older `.frameforge-effect.json` files and new `.kamikami-effect.json` files import normally.


## Independent layers and timeline elements — October 7, 2026

Layers are named timeline rows and may be empty or contain multiple image/video, audio, and text elements. Elements retain their own timing, transforms, sound settings and effects. Elements on the same layer cannot overlap; different layers can overlap. Media drops snap to frames and fill the available gap up to the source duration (still images extend to the next element or project end). Move existing elements vertically to change their layer, or use the Inspector's Layer selector.

Project settings and layer names are edited in dialogs with Save/Cancel. Deleting a layer is immediate and undoable. Backspace deletes selected elements while preserving their layers. The Inspector is reserved for the selected element and its applied effects; browsing an unrelated library effect opens its own dialog.

Existing projects migrate to one timeline layer per element. See [the layer model and compatibility notes](docs/timeline-layers.md) for storage and agent API details. Restart the local service after updating to this model so frontend and backend validations match.
