# KamiKami

A local video-editor prototype with a layered timeline, deterministic effects, and a native editing assistant. Electron shell + React/TypeScript + Remotion. The included station artwork is original SVG created for this prototype.

## Run

Requires Node 22+ and npm.

```sh
npm install
npm run desktop
```

Or run `npm run dev` and open `http://127.0.0.1:5173` in a browser. Both commands start the local service on port 4318. Run only one of them at a time. `desktop` is a development launcher, not yet a distributable app installer.

The development service watches source changes and restarts automatically. If upgrading from a launcher that did not watch the service, restart `npm run desktop` once so renderer and server share the current effect schema. Text-effect writes check the service version before saving to prevent unsupported fields from being stripped.

After changes to `electron/`, fully quit and restart `npm run desktop`; refreshing the editor only reloads the UI. A “No handler registered for project-file” error indicates the running desktop process has not loaded the project-file handlers. Wait for local recovery to finish, then restart the desktop launcher and retry Save.

## Native assistant

Open **Assistant**, choose **Connect assistant**, and enter a connection name, base URL, API key and model/deployment. OpenAI and LiteLLM/OpenAI-compatible proxies are supported. Choose Responses or Chat Completions to match the endpoint and model. **Load models** retrieves model aliases from the saved connection. Requests run inside the app; no terminal or external agent is required. Electron encrypts saved credentials with the OS-backed secure storage when available. Browser mode holds the key only in the local service's memory. `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`, `OPENAI_CONNECTION_NAME` and `OPENAI_API_MODE` (`responses` or `chat`) are also supported when launching the service. API access is billed by the provider; there is no KamiKami account or bundled subscription yet.

The assistant receives the current composition, selected clips and playhead. It can edit text, transforms, timing, layers, media and effects, inspect rendered frames, save portable effects, and export video. Attach media with the paperclip; it is copied into the library before sending. The model cannot browse arbitrary files on your computer. Messages, project details, library metadata and requested PNG previews are sent to the model; source videos/audio are not uploaded to the model by this integration.

Conversation history is saved locally. Steps and preview images appear beside the reply. **Stop** aborts model work and prevents new actions; an already-started editor operation settles first. Consecutive project edits from one request share an Undo step. Manual edits start a separate step; **Undo edits** only appears while that request owns the latest undoable edit. Saved user effects, imported assets and export files are separate library artifacts, not project Undo entries. Destructive clip removal and composition shortening show a confirmation in the panel.

Codex/Claude Code integration remains available as an advanced option through the same tool definitions and editor bridge. See [MCP setup and capabilities](docs/mcp.md). The primary app panel now contains the native assistant instead of MCP instructions.

## First session

1. Play or scrub the original 15-second sample composition.
2. Select an element on the canvas or timeline to open Inspector. Transform, trim, or edit its content and effects. Text elements include a visual font picker with 20 bundled families plus the original eight system choices. Search, category filters, favorites, and recent fonts help find a style; each option previews the selected text. Weight and style controls only offer faces available in the font. Import TTF, OTF, WOFF, or WOFF2 files (up to 20 MB each) from the picker; imported copies work offline. Bundled and imported fonts load from the same files in preview and export; missing files prompt reimport or replacement and block export. Legacy system fonts retain their existing fallback behavior. Layers are independent timeline rows: create them with **New layer**, rename them with their settings button, and drag elements between them. Numeric changes apply on Enter or blur; invalid entries remain visible with an explanation, and Escape restores the saved field value. Continuous typing in one field is a single undo step.
3. Open Effects. Hover a sample graphic to preview the actual effect, or use its Play/Stop control. Drag a recipe onto a timeline clip, then click the applied effect name to jump to its shared definition. The editor shows how many layers use the effect. Visual effects and transforms are unavailable for audio layers.
4. Open Media to import, search, preview, and reuse images/video/audio. Drag an asset onto a timeline layer at the desired time; importing to the library alone does not change the composition. Imports are copied into the local workspace. Browser codec support determines which source formats preview correctly; MP4/H.264 and standard image formats are recommended for this prototype.
5. Open Assistant and describe an edit. Watch the canvas and timeline update, review the action log, and use Undo edits to reverse the latest assistant edits.
6. Export video. The first export can download Remotion's local Chromium renderer; progress is shown and an MP4 download becomes available.

## Editing safeguards and appearance

- Shortening the composition lists affected clips and their before/after timing before you choose whether to trim them. Cancel preserves the project; a single Undo restores a confirmed change.
- Drag clips to see their destination time before release. Escape cancels a drag. The timeline ruler supports click/drag scrubbing, arrow keys for one-frame steps, Shift+arrows for one-second steps, and Home/End.
- Click the project name in the header to open the project settings dialog. The preview fits its window automatically.
- The header palette button opens four app themes: Original, Olive, Daylight, and Dusk. Each option shows its four palette colors; changes apply immediately and persist across reloads. Project artwork and effect colors remain independent of the app theme. Selected cards use a full background fill without left-edge accents.
- Drag the divider beside the library to resize it. Width persists across reloads; double-click resets it. Media includes Add media, delete and trash recovery controls. Open project sits next to Save in the header, with the project title centered. Add text from the Timeline toolbar.

## Canvas, timeline, and media tools

- **Dropdowns:** themed custom menus replace native selectors throughout the app, including curve, layer, font category/weight/style, API format, and model suggestions. Use arrow keys, Home/End, typing to jump, Enter to select, and Escape to dismiss. Model names still accept free text.
- **Canvas:** click a visible layer, then drag to move. Shift-click toggles multi-selection. Drag corners for proportional scale or the round handle to rotate; Shift snaps rotation to 15° steps. Arrow keys nudge by one composition pixel, Shift+arrows by ten. Center buttons align selected visible layers. Snapping uses canvas and layer centers; Alt bypasses it. Double-click text, then Apply or Cmd/Ctrl+Enter; Escape cancels.
- **Timeline:** drag the grip beside a layer name up/down to reorder the stack; Up/Down on a focused grip also moves it. Drag clips to move the selected group. Shift-click selects several; labels also accept Cmd/Ctrl-click. Drag either edge to trim, or focus an edge and use Left/Right (one frame, Shift for one second). Split cuts selected clips at the playhead, with at least three frames on each side. Zoom ranges from 1× to 8×; the factor button fits the timeline. Snap targets include clip boundaries and the playhead. Alt bypasses snapping. Each drag is one Undo step; Escape cancels it.
- **Media:** source duration/dimensions and waveforms persist between sessions. Source details are read on import; timed sources with missing metadata are inspected when added. Waveform decoding is limited to sources up to 32 MB and ten minutes; larger sources still support metadata and playback. Codec support determines whether previews/waveforms are available. Waveforms summarize the first audio channel.
- **Sound and recovery:** timeline and Inspector mute/solo controls apply to both audio and video layers. A soloed visible layer silences other audio/video layers. Refresh Media (or return to the app) to check missing sources. Relink replaces all project references in one undoable edit; replacement type must match and duration must cover every referenced clip. Missing visuals show a recovery placeholder.
- **Effects:** compact cards drag onto timeline clips; double-click inspects a definition and Enter applies to selected visual layers. Save snapshots to My effects or export/import portable effect bundles. The built-in library has 41 cards with search and category filters. Seven scene-inspired additions provide Typewriter, Text scramble, Staggered text (rise/flip/pop), Text wave, Flowing text gradient, Neon text, and Blinds reveal (horizontal/vertical). Typography previews use larger “Title” lettering on a dark stage in every theme; text recipes apply only to text elements. See [the scene catalog review](docs/remotion-scenes-effects.md). The second video study adds Color remap, Motion smear, Image repetition and Graphic rings; existing cards gain block/wave distortion, dotted print, radial particle bursts and outline modes. See [the second video analysis](docs/videoplayback-effects.md). Color flash, Color silhouette, Color grade, Scene light, and Camera zoom consolidate related looks into a Variation selector with editable parameters. The 36 original recipes remain compatible with existing projects. See [the consolidation audit](docs/effect-library-audit.md). Previews run six-second loops using the same curve and SVG graphics pipeline as the composition. Graphic-pass controls expose strength, colors, timing, size, speed and pattern settings. See [the timestamped visual analysis and composition recipes](docs/lost-time-memory-effects.md). Hover/focus starts playback; explicit Play/Stop is available. Reduced-motion users opt in with Play. Trim and split preserve animation continuity using effect offsets and the original effect duration.

See [the completed usability plan](docs/usability-plan.md) and [proposed next features](docs/feature-proposals.md).

## Storage

`.kamikami/project.json` is the current autosaved project. `.kamikami/media/` holds imported copies, and `.kamikami/library.json` persists their names and metadata. `.kamikami/exports/` holds rendered videos and agent-review PNG frames. `.kamikami/effects.json` stores reusable user effects. `.kamikami/fonts/` holds imported font files, and `.kamikami/fonts.json` stores the font catalog shared by projects in the workspace. Projects store snapshots of their custom font definitions; font bytes remain in the workspace. Keep the fonts directory when moving a project. Bundled fonts and their copyright/license notices live in `public/fonts/`. Favorites and recent font choices are local browser preferences. Deleted media is hidden in Media trash with its source bytes retained for recovery. `.kamikami/assistant.json` stores local conversations and connection metadata (never the API key). All workspace data is gitignored. Project writes use atomic rename. Header Save (⌘/Ctrl+S) writes project JSON to a chosen file: the first save opens a location picker, later saves overwrite that file. Open project in the header makes the opened JSON the current save destination after validation. The destination is remembered across app sessions; a missing file prompts for a location again. Background autosave continues to update the local recovery copy without modifying the chosen JSON. Desktop mode uses native file dialogs; browser mode requires file access APIs (Chrome/Edge) and may ask to renew file permission after reopening. Project JSON references workspace media and fonts; it does not embed those files. The agent save_project command continues to flush the local recovery copy without opening a file dialog. Undo history is in memory and resets on reload.

Keep the entire `.kamikami` directory to preserve media when moving this prototype. There is currently one active project per workspace. Rendering is local, at 1920×1080/24fps, with one export at a time. Long projects may be slow; start with short scenes.

## Architecture

- `src/model.ts`: backward-compatible project schema, independent timeline layers and elements, reusable effect definitions, deterministic curve evaluation.
- `src/Composition.tsx`: shared Remotion composition for preview and MP4 rendering. `FontText.tsx` waits for font loading before rendering text.
- `src/font-catalog.json`, `font-assets.ts`, and `font-loading.ts`: bundled catalog, validated font references, and shared browser font loading.
- `server/font-library.ts` and `font-metadata.ts`: persistent imports, file validation, face metadata, and missing-font preflight.
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

Effects use a declarative SDK: additive x/y/rotation/blur/letterSpacing/rotateY channels; multiplicative scale/opacity/brightness/contrast/saturation; linear/ease/ease-out/sine/pulse/shake/steps curves; an optional legacy color wash; and up to six SVG visual passes per effect. Passes provide light, texture, graphic overlays, alpha-aware cutout treatments, and reveals. Timing derives from the local clip frame and preserved trim offsets. No `eval`, arbitrary agent code, filesystem plugins, or custom GPU shaders. The legacy color wash still covers the layer rectangle on non-text layers; new graphic overlays use the element’s alpha. Artwork and multi-element compositions remain separate from effects.

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

`npm run test:ui` runs an isolated Chromium editor fixture on port 5174. It checks custom dropdowns, font previews/imports/favorites, dialogs, media drops, multiple elements per layer, cross-layer moves, effects, Undo/Redo and reload, without reading or writing your workspace or calling a model.

With the app running, `npm run test:service` additionally checks local request validation, imports a small generated image and tone, and exports/downloads a one-second video. It creates test assets and an export in `.kamikami`, but does not overwrite the active project or make model API calls.

With the editor open and no active field/gesture, `npm run test:mcp` exercises live MCP reads, edits, effects, ordering, selection, seeking, saving, revision conflicts, and Undo/Redo. It restores its own changes; avoid manual edits while it runs.

Verified October 6, 2026: 31 regression tests, TypeScript/Vite build, skill validation, and MCP editing/media/render/export checks. Desktop QA covered compact effect dragging and Undo, media deletion Cancel/Confirm/Undo, library resizing, layer ordering, and session status. A real Claude Code session created, applied, visually inspected, saved and exported Retro title sway, then restored the composition. Codex setup follows official documentation; a Codex model session has not been exercised.

## User effects and comprehensive agent verification

Agents can author effects through a schema, preview them on live clips, inspect rendered frames, and save reusable snapshots. Share `.kamikami-effect.json` files containing the recipe and compatibility version. Import them from Effects, then drag onto a visual clip. No executable plugin installation is required.

See [the capability audit](docs/mcp-audit.md) for the 37-tool editing map, test coverage and limits. Run `npm run test:mcp:full` with the editor open to exercise the complete workflow.

### Rename compatibility

The app is now **KamiKami**. Existing local workspace data moves from `.frameforge` to `.kamikami` automatically when needed. Existing desktop installations reuse their previous Electron profile so saved assistant credentials and preferences remain available. Effect bundles retain the version-1 `frameforge-effect` envelope. Legacy recipes use `frameforge-curves-v1`; visual passes and extended channels/curves use `kamikami-visual-v2`; the newer remap/smear/repetition/ring and pattern modes use `kamikami-visual-v3`; text animation and blinds use `kamikami-visual-v4` so older readers reject unsupported bundles. Both older `.frameforge-effect.json` files and new `.kamikami-effect.json` files import normally.


## Independent layers and timeline elements — October 7, 2026

Layers are named timeline rows and may be empty or contain multiple image/video, audio, and text elements. Elements retain their own timing, transforms, sound settings and effects. Elements on the same layer cannot overlap; different layers can overlap. Media drops snap to frames and fill the available gap up to the source duration (still images extend to the next element or project end). Move existing elements vertically to change their layer, or use the Inspector's Layer selector.

Project settings and layer names are edited in dialogs with Save/Cancel. Deleting a layer is immediate and undoable. Backspace deletes selected elements while preserving their layers. The Inspector is reserved for the selected element and its applied effects. Click an applied effect's name or inspect a library effect to edit its definition in a dialog. Effect settings use a draft: Save changes applies the definition as one undoable edit, while Cancel, Escape, or the header close button discard uncommitted changes. The header and save actions stay visible while grouped controls scroll. Reuse & share at the bottom saves the draft to My effects or exports an effect bundle independently of the project save.

Existing projects migrate to one timeline layer per element. See [the layer model and compatibility notes](docs/timeline-layers.md) for storage and agent API details. Restart the local service after updating to this model so frontend and backend validations match.
