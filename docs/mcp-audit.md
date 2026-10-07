# Editor automation and user-effect audit

Audit date: October 6, 2026.

## Coverage

The MCP server exposes 37 tools. Project mutations run in the live editor through its command bridge, validation, revision checks, Undo history and autosave. The server does not silently edit the saved project behind the UI. Imports refresh the visible library; export and rendering requests use the live project snapshot.

| Editor capability | MCP tools | Verification |
| --- | --- | --- |
| Inspect live state and schemas | `get_project`, `get_capabilities` | Revision, selection, playhead, playback, project/effect/bundle schemas |
| Text and canvas properties | `add_text`, `update_layer` | Text, font, color, x/y, scale, rotation, opacity, visibility; center alignment via x/y=0 |
| Layer structure | `duplicate_layers`, `delete_layers`, `reorder_layers`, `apply_project` | Unique IDs, complete order, grouped edits and project replacement |
| Timeline | `move_clips`, `trim_clip`, `split_clips` | Frame alignment, group movement, source/effect offsets, minimum lengths |
| Project settings | `set_project_settings` | Name/duration; shortening requires explicit trim acknowledgement |
| Media | `import_media`, `analyze_media`, `get_media_library`, `add_media` | Image/audio/video imports, metadata, waveforms, source reuse |
| Media recovery | `delete_media`, `restore_media`, `relink_media` | Used-media confirmation result, clip removal, trash, Undo/Redo, missing source replacement |
| Audio | `update_layer` | Volume, mute, solo and visibility |
| Playback/selection | `select_layers`, `set_playhead`, `set_playback` | Changes visible in the canvas and timeline |
| Project effects | `create_effect`, `update_effect`, `apply_effect`, `remove_effect` | New definitions, settings, instances, audio rejection and duplicate prevention |
| Persistent/shareable effects | `get_effect_library`, `save_user_effect`, `export_effect_bundle`, `import_effect_bundle` | Persistence, metadata, independent snapshots, ID remapping and compatibility validation |
| Visual review | `render_frame`, `get_render` | Actual PNG output at two frames, exact revision/frame metadata |
| Video export | `export_video`, `get_export` | Live-project MP4 export with editor progress and download |
| History/storage | `undo`, `redo`, `save_project` | Shared transactions, restoration and saved snapshot |

## Boundary of “all editing functionality”

Composition content, media management, effects, playback, frame inspection and video export are covered. Window geometry, library width, panel tabs, timeline zoom and snapping preferences remain UI settings. Agents can directly choose exact values without manipulating those preferences. The editor itself does not yet provide a freeform keyframe graph, arbitrary effect code/shaders, media generation, project collections, export presets or cloud collaboration; MCP does not add those features implicitly.

Structured edits are reflected live. A rendered PNG represents its recorded project revision, even if someone makes another edit while rendering. Still frames verify appearance, not smooth motion or audio quality. Listen/watch playback for those checks. Metadata/waveform support depends on source codecs.

## Effect bundles

`*.kamikami-effect.json` is a portable declarative recipe with:

- `format: "frameforge-effect"`, `version: 1`, `engine: "frameforge-curves-v1"`;
- name, description, author and license/sharing terms;
- the complete effect definition, including curve channels and tint.

No external media paths, dependencies, executable scripts or secrets are needed. Import validates the schema/engine and assigns a fresh effect ID. Applying a saved effect copies the definition into the project, so the composition remains self-contained. Updating a project instance does not mutate another user's saved library copy. Save a new snapshot to publish a variant. Import/export are local; users distribute the JSON file themselves and retain the author's sharing terms.

Draft effects live in the project. Saved snapshots live in `.kamikami/effects.json` and appear under **My effects**, independently of the active project. Inspector provides Save to My effects and Export effect bundle. Another user imports through the Effects tab and drags the card onto a clip.

## Repeatable checks

- `npm test`: model/history/media/bridge/editing regression tests, plus bundle compatibility, collision remapping, source retention, effect application and timing safeguards.
- `npm run test:mcp`: core editing/Undo smoke test.
- `npm run test:mcp:full`: all advertised MCP tools, generated image/audio/video fixtures, source deletion/restoration/relinking, two PNG frame renders, effect bundle round trip and MP4 export. It restores the starting composition, selection and frame, and writes a coverage report and frame images to a temporary directory. It leaves test imports, saved test effects and exports for inspection; archive them afterward.
- Desktop QA: compact cards, pointer drop and Undo, first Inspector tab, timeline-only Text action, used-media Cancel/Delete/Undo, trash recovery and responsive libraries.

Run editor integration checks while the app is open and no field or drag is active. Avoid manual project edits during a test. Revision checks stop the test from overwriting intervening changes.

## Final results

All 31 regression tests and the TypeScript/Vite build passed. The complete integration run exercised **all 37 advertised MCP tools**, including actual PNG and MP4 output, and restored the starting composition. [Machine-readable coverage](mcp-verification.json) records the tool set and results.

A real Claude Code session created **Retro title sway**, applied it to the main title, inspected PNGs at frames 24 and 72, saved it to My effects and exported its bundle. It restored the starting composition afterward. The agent observed opposite slight title rotations, but did not claim that stills proved smooth motion or precisely measured the subtle horizontal displacement. The saved effect persisted after editor reload. [Example bundle](../examples/effects/retro-title-sway.kamikami-effect.json).

Desktop testing passed effect drop/Undo and media deletion Cancel/Confirm/Undo. Test-only assets, effects and renders were archived outside the workspace. The original project matched the pre-task backup. Existing build warnings concern dependency annotations and bundle size. The actual model-client workflow was tested with Claude Code; Codex setup is supplied but a Codex model session was not exercised.
