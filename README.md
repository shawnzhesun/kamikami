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
3. Open Effects. Hover a sample graphic to preview the actual effect, or use its Play/Stop control. Drag a recipe onto a timeline clip, then click the applied effect name to edit that instance. Each element keeps its own settings; library originals are read-only and offer Fork to create a personal copy. Visual effects and transforms are unavailable for audio layers.
4. Open Media to import, search, preview, and reuse images/video/audio. Drag an asset onto a timeline layer at the desired time; importing to the library alone does not change the composition. Imports are copied into the local workspace. Browser codec support determines which source formats preview correctly; MP4/H.264 and standard image formats are recommended for this prototype.
5. Open Assistant and describe an edit. Watch the canvas and timeline update, review the action log, and use Undo edits to reverse the latest assistant edits.
6. Export video. The first export can download Remotion's local Chromium renderer; progress is shown and an MP4 download becomes available.

## Editing safeguards and appearance

- Shortening the composition lists affected clips and their before/after timing before you choose whether to trim them. Cancel preserves the project; a single Undo restores a confirmed change.
- Drag clips to see their destination time before release. Escape cancels a drag. The timeline ruler supports click/drag scrubbing, arrow keys for one-frame steps, Shift+arrows for one-second steps, and Home/End.
- Click the project name in the header to open the project settings dialog. The preview fits its window automatically.
- The header palette button opens four app themes: Original, Olive, Daylight, and Dusk. Each option shows its four palette colors; changes apply immediately and persist across reloads. Project artwork and effect colors remain independent of the app theme. Selected cards use a full background fill without left-edge accents.
- Drag the divider beside the library to resize it. Width persists across reloads; double-click resets it. Media includes Add media, delete and trash recovery controls. New project and Open project sit right of the logo, with the project title centered; on narrow windows they shrink to icons. Add text from the Timeline toolbar.

## Canvas, timeline, and media tools

- **Dropdowns:** themed custom menus replace native selectors throughout the app, including curve, layer, font category/weight/style, API format, and model suggestions. Use arrow keys, Home/End, typing to jump, Enter to select, and Escape to dismiss. Model names still accept free text.
- **Canvas:** click a visible layer, then drag to move. Shift-click toggles multi-selection. Drag corners for proportional scale or the round handle to rotate; Shift snaps rotation to 15° steps. Arrow keys nudge by one composition pixel, Shift+arrows by ten. Center buttons align selected visible layers. Snapping uses canvas and layer centers; Alt bypasses it. Double-click text, then Apply or Cmd/Ctrl+Enter; Escape cancels.
- **Timeline:** drag the grip beside a layer name up/down to reorder the stack; Up/Down on a focused grip also moves it. Drag clips to move the selected group. Shift-click selects several; labels also accept Cmd/Ctrl-click. Drag either edge to trim, or focus an edge and use Left/Right (one frame, Shift for one second). Split cuts selected clips at the playhead, with at least three frames on each side. Zoom ranges from 1× to 8×; the factor button fits the timeline. Snap targets include clip boundaries and the playhead. Alt bypasses snapping. Each drag is one Undo step; Escape cancels it.
- **Media:** source duration/dimensions and waveforms persist between sessions. Source details are read on import; timed sources with missing metadata are inspected when added. Waveform decoding is limited to sources up to 32 MB and ten minutes; larger sources still support metadata and playback. Codec support determines whether previews/waveforms are available. Waveforms summarize the first audio channel.
- **Sound and recovery:** timeline and Inspector mute/solo controls apply to both audio and video layers. A soloed visible layer silences other audio/video layers. Refresh Media (or return to the app) to check missing sources. Relink replaces all project references in one undoable edit; replacement type must match and duration must cover every referenced clip. Missing visuals show a recovery placeholder.
- **Effects:** compact cards drag onto timeline clips; double-click inspects a definition and Enter applies to selected visual layers. Save snapshots to My effects or export/import portable effect bundles. The built-in library has 95 cards with search and category filters. Seven scene-inspired additions provide Typewriter, Text scramble, Staggered text (rise/flip/pop), Text wave, Flowing text gradient, Neon text, and Blinds reveal (horizontal/vertical). Typography previews use larger “Title” lettering on a dark stage in every theme; text recipes apply only to text elements. See [the scene catalog review](docs/remotion-scenes-effects.md). The second video study adds Color remap, Motion smear, Image repetition and Graphic rings; existing cards gain block/wave distortion, dotted print, radial particle bursts and outline modes. See [the second video analysis](docs/videoplayback-effects.md). Color flash, Color silhouette, Color grade, Scene light, and Camera zoom consolidate related looks into a Variation selector with editable parameters. The 36 original recipes remain compatible with existing projects. See [the consolidation audit](docs/effect-library-audit.md). Previews run six-second loops using the same curve and SVG graphics pipeline as the composition. Graphic-pass controls expose strength, colors, timing, size, speed and pattern settings. See [the timestamped visual analysis and composition recipes](docs/lost-time-memory-effects.md). Hover/focus starts playback; explicit Play/Stop is available. Reduced-motion users opt in with Play. Split and left-trim preserve animation continuity using effect offsets and the original effect duration. Trimming the right edge of a whole (never split or left-trimmed) clip moves its exit timing with the new end, so fade-outs and "At clip end" transitions still complete.

See [the videoplayback.mp4 re-creation case study](docs/videoplayback-recreation-study.md), [the completed usability plan](docs/usability-plan.md) and [proposed next features](docs/feature-proposals.md).

## Storage

`.kamikami/project.json` is the current autosaved project. `.kamikami/media/` holds imported copies, and `.kamikami/library.json` persists their names and metadata. `.kamikami/exports/` holds rendered videos and agent-review PNG frames. `.kamikami/effects.json` stores reusable user effects. `.kamikami/fonts/` holds imported font files, and `.kamikami/fonts.json` stores the font catalog shared by projects in the workspace. Projects store snapshots of their custom font definitions; font bytes remain in the workspace. Keep the fonts directory when moving a project. Bundled fonts and their copyright/license notices live in `public/fonts/`. Favorites and recent font choices are local browser preferences. Deleted media is hidden in Media trash with its source bytes retained for recovery. `.kamikami/assistant.json` stores local conversations and connection metadata (never the API key). All workspace data is gitignored. Project writes use atomic rename. Header Save (⌘/Ctrl+S) writes project JSON to a chosen file: the first save opens a location picker, later saves overwrite that file. Open project in the header makes the opened JSON the current save destination after validation. New project replaces the editor contents with an empty project that keeps the canvas size and frame rate. If the current project has changes not in its file, it first asks to Save, Don’t save or Cancel. It also forgets the save destination, so the next Save asks for a new file and never overwrites the previous project; Undo brings the previous project back within the session. The destination is remembered across app sessions; a missing file prompts for a location again. Background autosave continues to update the local recovery copy without modifying the chosen JSON. Desktop mode uses native file dialogs; browser mode requires file access APIs (Chrome/Edge) and may ask to renew file permission after reopening. Project JSON references workspace media and fonts; it does not embed those files. The agent save_project command continues to flush the local recovery copy without opening a file dialog. Undo history is in memory and resets on reload.

Keep the entire `.kamikami` directory to preserve media when moving this prototype. There is currently one active project per workspace. Rendering is local at the project's size and frame rate (1920×1080 at 24 fps by default), with one export at a time. Long projects may be slow; start with short scenes.

## Architecture

- `src/model.ts`: backward-compatible project schema, independent timeline layers and elements, reusable effect presets, independent instance settings, deterministic curve evaluation.
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

Effects use a declarative SDK: additive x/y/rotation/blur/letterSpacing/rotateX/rotateY/skewX channels; multiplicative scale/scaleX/scaleY/opacity/brightness/contrast/saturation; linear/ease/ease-out/sine/pulse/shake/steps and spring back/anticipate/elastic/bounce/damped curves, optionally over their own seconds at the clip start or end; an optional legacy color wash; and up to six SVG visual passes per effect. Passes provide light, texture, graphic overlays, alpha-aware cutout treatments, and reveals. Timing derives from the local clip frame and preserved trim offsets. No `eval`, arbitrary agent code, filesystem plugins, or custom GPU shaders. The legacy color wash still covers the layer rectangle on non-text layers; new graphic overlays use the element’s alpha. Artwork and multi-element compositions remain separate from effects.

Text Glitch and Depth Motion add configurable text corruption and projected depth travel. Particles, Image Repetition and Staggered Text now include depth, tunnel, orbit, glyph-field and assembly presets. Settings remain independent per applied instance. See [motion effects](docs/motion-effects.md) for controls, compatibility and rendering limits. These recipes use `kamikami-visual-v5`; restart the local service after updating.

## Deliberate limits and next iterations

- No arbitrary TypeScript effect compilation yet. First prove the schema-based create/preview/tweak/export loop; then add an isolated plugin worker with explicit capabilities.
- Keyframes cover element transforms, opacity, volume, effect strength and numeric effect parameters with named easing; there is no graph editor for custom Bézier handles yet (agents can supply `bezier` control points).
- No beat detection, lyric alignment, or AI image generation yet. Agents can inspect rendered PNG frames; motion/audio review still requires playback.
- No cloud hosting, accounts, marketplace, or collaboration.
- Limits: 60-minute compositions, 500 elements on up to 40 layers, 200 effect definitions, 4 GB per import.
- Local endpoints enforce loopback host/origin and a custom mutation header. This is a single-user development service, not a remotely deployable backend.
- Review Remotion licensing before commercial deployment: https://www.remotion.dev/docs/license/pricing

## Checks

```sh
npm test
npm run build
npm run test:ui
```

`npm run test:ui:keyframes` runs the same isolated fixture through the stopwatch, auto-key, timeline diamonds, keyframe navigation and versioned saving.

`npm run test:ui` runs an isolated Chromium editor fixture on port 5174. It checks custom dropdowns, font previews/imports/favorites, dialogs, media drops, multiple elements per layer, cross-layer moves, effects, Undo/Redo and reload, without reading or writing your workspace or calling a model.

With the app running, `npm run test:service` additionally checks local request validation, imports a small generated image and tone, and exports/downloads a one-second video. It creates test assets and an export in `.kamikami`, but does not overwrite the active project or make model API calls.

With the editor open and no active field/gesture, `npm run test:mcp` exercises live MCP reads, edits, effects, ordering, selection, seeking, saving, revision conflicts, and Undo/Redo. It restores its own changes; avoid manual edits while it runs.

Verified October 6, 2026: 31 regression tests, TypeScript/Vite build, skill validation, and MCP editing/media/render/export checks. Desktop QA covered compact effect dragging and Undo, media deletion Cancel/Confirm/Undo, library resizing, layer ordering, and session status. A real Claude Code session created, applied, visually inspected, saved and exported Retro title sway, then restored the composition. Codex setup follows official documentation; a Codex model session has not been exercised.

## User effects and comprehensive agent verification

Agents can author effects through a schema, preview them on live clips, inspect rendered frames, and save reusable snapshots. Share `.kamikami-effect.json` files containing the recipe and compatibility version. Import them from Effects, then drag onto a visual clip. No executable plugin installation is required.

See [the capability audit](docs/mcp-audit.md) for the editing map (43 tools today; the audit recorded 37), test coverage and limits. Run `npm run test:mcp:full` with the editor open to exercise the complete workflow.

### Rename compatibility

The app is now **KamiKami**. Existing local workspace data moves from `.frameforge` to `.kamikami` automatically when needed. Existing desktop installations reuse their previous Electron profile so saved assistant credentials and preferences remain available. Effect bundles retain the version-1 `frameforge-effect` envelope. Legacy recipes use `frameforge-curves-v1`; visual passes and extended channels/curves use `kamikami-visual-v2`; the newer remap/smear/repetition/ring and pattern modes use `kamikami-visual-v3`; text animation and blinds use `kamikami-visual-v4`; spatial motion and text glitches use `kamikami-visual-v5`; spring curves, span-timed and stretch/skew/tilt channels and the illustration, 3D-look and organic passes use `kamikami-visual-v6`; title-pack text animations use `kamikami-visual-v7`, so older readers reject unsupported bundles. Exported bundles below v5 omit `presetFamilyId`, which older strict readers reject. Both older `.frameforge-effect.json` files and new `.kamikami-effect.json` files import normally.


## Independent layers and timeline elements — October 7, 2026

Layers are named timeline rows and may be empty or contain multiple image/video, audio, and text elements. Elements retain their own timing, transforms, sound settings and effects. Elements on the same layer cannot overlap; different layers can overlap. Media drops snap to frames and fill the available gap up to the source duration (still images extend to the next element or project end). Move existing elements vertically to change their layer, or use the Inspector's Layer selector.

Project settings and layer names are edited in dialogs with Save/Cancel. Deleting a layer is immediate and undoable. Backspace deletes selected elements while preserving their layers. The Inspector is reserved for the selected element and its applied effects. Double-click an Effect Library card to see its General overview and Fork a copy into My effects. Double-click My effects to edit its name and default parameters, fork it, or delete it. Click an applied effect to edit only that instance’s parameters, with no name editing, Fork, or Delete. The preset picker loads starting parameters with previews; manual adjustments stay editable without a Custom entry. Effect settings use a draft: Save changes applies one undoable edit, while Cancel, Escape, or the header close button discard uncommitted changes. The header and save actions stay visible while grouped controls scroll. Fork creates a reusable copy independently of the project save. Effect modals do not offer export actions. Project JSON version 2 stores each instance’s complete settings. Version-1 projects migrate automatically with their existing appearance; older apps reject version-2 files instead of discarding local adjustments. See [effect instance architecture](docs/effect-instances.md).

Existing projects migrate to one timeline layer per element. See [the layer model and compatibility notes](docs/timeline-layers.md) for storage and agent API details. Restart the local service after updating to this model so frontend and backend validations match.


## Keyframes — October 9, 2026

Every numeric transform in Inspector (X, Y, scale, rotation, opacity and, for audio/video, volume) has a **stopwatch**, following the After Effects and Premiere Pro model. Click it to animate the property: a keyframe is created at the playhead, and from then on any edit at the playhead (typing a value, dragging, scaling, rotating or nudging on the canvas, centering) writes a keyframe instead of changing the static value. ◀ / ▶ jump between keyframes, ◆ adds or removes the keyframe at the playhead, and the interpolation menu on a keyframe sets the segment that leaves it: Linear, Ease in, Ease out, Easy ease or Hold (custom cubic-Bézier curves are available to agents). Turning the stopwatch off keeps the value shown at the playhead.

Effects are keyframeable too. Each applied effect's **Strength** has a stopwatch, and **Animate parameter…** lists every numeric setting of that instance (pass size, speed, angle, channel endpoints, text distance, depth travel and so on) so it can be animated the same way. Effect channels and passes still layer on top of keyframed values.

Keyframes appear as diamonds on timeline clips, like Final Cut Pro's clip keyframes: click to seek, drag to retime every key at that frame. Keyframes live on the clip's animation clock (clip time plus effect offset), so they move with the clip and survive left trims and splits. Projects containing keyframes are saved as version 3, so older readers reject them instead of discarding the animation; projects without keyframes stay at version 2. Agents use `set_keyframes`. See [keyframes](docs/keyframes.md).

## Spring, illustration and 3D-look effects — October 9, 2026

Fourteen new cards (37 named looks) extend the library without duplicating earlier treatments: **Spring motion** (elastic pop, bounce drop, jelly wobble, overshoot slide, 3D flip, pendulum, anticipation exit), **Line boil**, **Liquid warp** (flow, heat haze, melt), **Paper cutout**, **Comic ink**, **Pixel art** (pixelate, pixel-in, 1-bit and four-tone dithering), **Bevel & emboss**, **Solid extrusion** (isometric block, long shadow), **Holo card**, **Lens bulge**, **Light sweep**, **Energy edge**, **Noise dissolve** and **Gooey morph**. Channels gain `scaleX`, `scaleY`, `skewX` and `rotateX`, spring curves (`back`, `anticipate`, `elastic`, `bounce`, `damped`), and optional per-channel `seconds`/`align` spans so a curve can run as a short entrance or exit. These use `kamikami-visual-v6`. See [the new effects](docs/style-effects.md).

## Title animations — October 9, 2026

Twenty title looks on sixteen Typography cards, modeled on commercial title packs such as MotionVFX's mTitle line (Apple-keynote kinetic type, minimal line and box reveals, stretch/split/repeat "hype" titles): **Mask reveal** (rise, slide), **Focus in** (soft focus, zoom slam), **Stretch in**, **Swipe in**, **Slot roll**, **Bouncy letters** (bounce drop, elastic pop), **Turn in**, **Highlight** (marker swipe, block wipe), **Underline reveal**, **Outline fill**, **Echo stack**, **Split slice**, **Stroke draw**, **Flicker on**, **Number count** and **Circle text**. Each can play as an entrance or an exit, animate by character, word or whole title where relevant, and combine with the existing text effects and keyframes. They use `kamikami-visual-v7`. See [title animations](docs/title-effects.md).

## Open-source-inspired effects — October 9, 2026

Twenty-three effects chosen from [the candidate survey](docs/effect-candidates.md) of React Bits, Motion Primitives, Magic UI, gl-transitions, PixiJS filters, Remotion, Motion Canvas and editly. Each is reimplemented from the observed motion, not copied code.

- **Text:** Blur rise, Karaoke, Shimmer, Prism reveal, Letter bubbles, Split-flap board, Cube roll, Odometer (a Number count variation), Retype, Word rotator, Type and delete, and Gooey word morph.
- **Reveals and looks:** Shape iris (star/heart/flower/diamond/rectangle), Barn doors, Clock wipe / pinwheel, Feathered wipe, Luma wipe, Reflection, Tilt-shift, Old film, 3D card moves (cube turn, page turn, corner roll, hinge swing, swap back), Ripple (ripples/shockwave/water drop), and Cell reveal.

Effects can now set a transform pivot (`origin`) for hinged moves. Retype, Word rotator, Type and delete and Gooey word morph use each line of the text as one step. All of these use `kamikami-visual-v7`.

## Assistant-driven media analysis and editing core — October 11, 2026

See [the design](docs/asset-analysis-design.md).

**Analysis**
- Every import is probed locally and for free with bundled ffmpeg: shots, loudness, silences, black or frozen spans, audio tracks, and a content hash.
- **Analyze** in Media shows an estimate. After you consent per provider, it sends contact sheets of shot keyframes and images to your assistant connection for captions and descriptions, then writes a one-line summary, tags and scenes in the UI language.
- Transcription with word timings (`/audio/transcriptions`, `whisper-1`) is **opt-in** in Assistant settings, as is auto-transcribing new imports.
- Paste lyrics or a script when analyzing one asset and they are aligned to the recognized words, line by line, with low-confidence words flagged.
- Results live in `.kamikami/analysis/<sha256>.json`, so renamed or relinked files keep their analysis.
- Media cards show an analysis status. **Details** opens the transcript, shots, description and audio; clicking a word or shot seeks the preview.

**Assistant and MCP tools**
- `get_asset_analysis`, `search_assets`, `view_asset_range` (frames over a waveform) and `view_timeline_range` (the rendered cut).
- `analyze_assets`, which always asks for approval of the estimate.
- Editing tools: `apply_edit_list`, `cut_source_ranges`, `ripple_delete`, `ripple_delete_clips`, `ripple_insert`, `crossfade` and `detach_audio`.

**Editing core**
- Up to 500 elements, one-hour projects and 4 GB imports.
- Ripple delete with **Shift+Backspace**.
- Fade-in and fade-out per clip, with automatic de-click ramps at audio edges.
- Crossfades and detaching a video's audio (any recorded track).
- Project settings choose the output size (including 9:16 vertical), frame rate (23.976–60 fps) and export loudness (−14, −16 or −23 LUFS, two-pass loudnorm).

The bundled `ffmpeg-static` build is GPL with nonfree components. It is fine for development, but must be replaced before distribution (see the design doc).

## Shapes and assistant-written asset metadata — October 12, 2026

**Shapes**
- **+ Shape** next to **+ Text** adds rectangles, rounded rectangles, circles, ellipses, triangles, diamonds, pentagons, hexagons, stars, arrows, hearts, lines and rings, in a swatch or custom color.
- Shapes are vector elements that behave like images: move, scale and rotate them on the canvas, apply effects, keyframe them and fade them.
- The inspector edits the shape type, size, corner radius, sides or points, fill and outline.
- If the selected layer is busy at the playhead, the new element goes on a new layer instead of failing (this applies to text too).
- The assistant and MCP use `add_shape`, and `update_layer` with `patch.shape` to change one. Projects with shapes are saved as version 3.

**Asset metadata without running analysis**
- Describe assets in the assistant chat, or paste results from analysis done elsewhere (descriptions, tags, scene lists, timed transcripts). The assistant saves them with `set_asset_metadata`, in batches of up to 100 assets.
- Fields:
  - summary and tags, used in the library digest;
  - a free-form description;
  - scenes for video, and sections for audio and video;
  - a transcript with segment times and optional word times;
  - image fields: caption, details, on-screen text, colors and safe text region.
- Times are checked against each asset's duration. Unprobed files get the free local probe first.
- Written fields are marked manual. Later automatic analysis keeps them and skips the paid stages they replace (summary, transcription, image description). Use `clear` to remove them.
- **Details** shows the description and which fields were written by you or the assistant.

## Kinetic type and lyric-video fonts — October 12, 2026

A new **Kinetic type** category adds 36 cards for lyric-video typography. They are reimplemented from a study of the techniques in [JIZURA](https://github.com/852wa/JIZURA) (MIT); no code was copied.
- **Entrances (20):** spring, hop, roll, hinge drop, word spin, word slam, fan open, drum unroll, shuffle, card flip, ripple, magnifier sweep, glint, brush, ink drop, decode, matrix rain, push in, word flash and inertia slide. Each can also play backwards as an exit.
- **Exits (7):** word kick, launch, flutter away, domino topple, close the gap, burn away and tornado.
- **Holds (9):** plucked string, beat hop, color run, dangle, counter rock, word ride, gap breath, word pulse and beat lean. Holds loop on a **Tempo (BPM)** setting, start once the element's entrances finish and stop before its exits, so one title can stack an entrance, a hold and an exit.
- **Word** units move whole words as one rigid piece (hinges, spins, slams); **Whole title** moves the entire text. Stagger order gains **Center out** and **Edges in**.
- Motions use the element's real letter positions, measured from the loaded font.
- They need `kamikami-visual-v8`; restart the desktop app after updating.

Sixteen font families are added, all under the SIL Open Font License: Dela Gothic One, Zen Kaku Gothic New, Zen Old Mincho, Shippori Mincho B1, Kaisei Tokumin, M PLUS Rounded 1c, Kiwi Maru, Mochiy Pop One, DotGothic16, Reggae One, Rampart One, Potta One, Klee One, Yuji Syuku, IBM Plex Sans and IBM Plex Mono. The Japanese families ship as Latin-only WOFF2 subsets (about 680 KB in total); IBM Plex ships unchanged because its license reserves the name. Notices are in `public/fonts/LICENSES.txt`. See [kinetic type](docs/kinetic-type.md).

## Text treatments and backdrops — October 12, 2026

JIZURA's frames look rich because every shot stacks motion, a paint treatment, decorations, a full-frame background, a finish and one shared palette. KamiKami has each of those as separate pieces, so they can be combined freely rather than picked as presets.
- **Text treatments** (23 cards): outline only, keyline, double outline, extrude, long shadow, offset shadow, neon tube, chrome, sticker, shadow stack, halftone fill, accent word, color ghosts that trail any motion, reflection, cut and shift, word boxes, word plates, corner brackets, rules, an index label, a text ticker, caution tape and a ray burst. They combine with kinetic type and each other.
- **+ Backdrop** adds full-frame, animated elements on their own full-length layers. Backgrounds go under everything: soft gradient, concentric rings, halftone fade, sunburst rays, stripes, dot grid, starfield, equalizer bars, scan bands, retro grid, text wall and split color. Finishes go on top and blend with every layer below: film grain, scanlines, vignette and light leak. The assistant uses `add_backdrop`.
- Requires `kamikami-visual-v8` and the `backdrop` element type; restart the desktop app after updating. Projects with backdrops are saved as version 3. See [text treatments and backdrops](docs/text-treatments.md).

## Artwork treatments — October 12, 2026

Fourteen **Artwork** cards treat your own images, video, shapes and backdrops, so artwork moves with the same energy as the type. Each is one piece to combine, not a preset.
- **Camera and beat:** handheld drift, beat punch, beat jolt, beat strobe and stop-motion stutter. Beat cards share one tempo counted from the project start, so every element hits together. Camera cards work on text too.
- **Copies:** color ghost trails that follow any motion, and slice shifts that knock on the beat or slide in and out.
- **Framing:** print border, block shadow, offset frame, corner brackets, crop marks, an index label and tape corners, laid out around the artwork's visible box.
- Requires `kamikami-visual-v8`; restart the desktop app after updating. See [artwork treatments](docs/artwork.md).

## Kinetic layouts — October 12, 2026

Ten **Kinetic layouts** cards compose a whole lyric line instead of moving letters in place: each word moves as one piece from the normal line into a designed arrangement, and the move is the animation.
- Justified slam stack, key word split, size steps and cropped giant word (the key word huge and cropped behind the readable line).
- Word swap (one word per beat in the center, then the full line), type then slam, flow then snap, seesaw on the beat, arc ride and band reveal.
- Layouts stack with kinetic motions and text treatments. Requires `kamikami-visual-v8`. See [kinetic type](docs/kinetic-type.md#kinetic-layouts).
