# Project model

The schema is in `src/model.ts` (`ProjectSchema`). Everything is validated by `validateProject`, which also migrates older data and turns schema failures into one readable sentence naming the element.

## Tracks and elements

- **`project.tracks`** are the timeline rows ("layers" in the UI): `{id, name}`, ordered bottom to top. A track can be empty or hold many elements.
- **`project.layers`** is the list of **elements**. The name is legacy; `TimelineElement` is an alias. Each element has its own timing, transforms, source, text, effects and `trackId`.
- Element types: `scene`, `title` (text), `image`, `video`, `audio`, `shape` (needs `shape`), `backdrop` (needs `backdrop`). Shapes and backdrops have no `src`.
- Elements on one track can't overlap. An element with no `trackId` gets its own new track. An unknown `trackId` is an error. Deleting a track deletes its elements (undoable).
- Times are seconds. `x`/`y` are pixels from the canvas center. `start` and `duration` place the clip; `offset` and `effectOffset` preserve source and animation continuity through trims and splits.
- Agent commands that say `layerId` or `layerIds` mean elements. Track tools are `create_track`, `update_track`, `delete_track` and `reorder_tracks`.

## Effect instances

- **`project.effects`** are preset definitions. Each element's `effects` list holds **instances**: `{effectId, amount 0–2, enabled, settings, keyframes?}`.
- `settings` is a complete snapshot of the effect (minus `id`). Editing an instance never changes the preset or other elements; editing a preset never changes existing instances.
- There is one instance per preset per element, up to `LIMITS.elementEffects` per element. Re-applying a preset the element already has does nothing.
- `resolveEffectInstance` (`src/effect-instance.ts`) is the single resolver used by every renderer.
- Agents use `update_effect_instance` to change one element's settings and `update_effect` to change an editable preset. Built-in and imported originals are read-only.

## Keyframes

Keyframes are defined in `src/keyframes.ts`.

| Animatable | Paths |
| --- | --- |
| Element | `x`, `y`, `scale`, `rotation`, `opacity`, and `volume` (audio/video only; transforms aren't valid on audio) |
| Effect instance | `amount`, and numeric settings by path, such as `passes.0.size`, `text.distance`, `overlay.size`  |

- **Keyframe shape:** `{time, value, easing, bezier?}`. Easing is one of `linear`, `ease-in`, `ease-out`, `ease-in-out` (shown as "Easy ease"), `hold` or `bezier`.
- **Interpolation:** a key's easing shapes the segment that *leaves* it. Values hold before the first key and after the last.
- **Clock:** times are on the clip's animation clock (clip time plus `effectOffset`), so keys move with the clip and survive trims and splits.
- **Frames:** keys snap to frames at the project fps.
- **Rounding:** `count` and `seed` values are rounded.
- **Animated vs static:** a track replaces the static value. Effects still layer on top of keyframed values.
- **Pruning:** when a settings change removes a keyed path (for example choosing another variation), its track is removed.
- **Agents:** `set_keyframes` takes clip-local times.

## Format

A project's size and frame rate are chosen in **New project** and never change afterwards: no command, including `apply_project`, can alter them (`sameFormat` in `src/model.ts`, checked by `applyAgentEdit`). Exports render at exactly that size and rate.

- **Units:** element `x`/`y`, `fontSize` and shape sizes are project pixels. Pixel amounts inside effects (channel x/y/blur/letterSpacing, pass sizes and strokes, perspective) are *reference pixels* for a frame whose short side is 1080, multiplied by `frameUnit` (`src/model.ts`) at render time. A 1080p project renders exactly as authored; 4K doubles them; 9:16 and 1:1 match 16:9. Overlays (2.5% of the short side), artwork moves and text effects (em) follow the same rule.
- **Defaults:** new text and shape presets are sized with `frameUnit`, so they take the same share of any frame.
- **Scene artwork** is a 1920×1080 board that other aspect ratios crop around its subject (`stationView` in `src/Composition.tsx`). Supported values are `frameRates` and even sizes in the project schema; `resolutionPresets` are the size presets.

## Versions and compatibility

| Version | Written when | Notes |
| --- | --- | --- |
| 1 | Never | Loads as v2; instance snapshots are filled from the preset definitions |
| 2 | Default | — |
| 3 | Any element has keyframes, a shape or a backdrop | Older apps reject the file instead of dropping data |

- **Migrations run on load:** old framing decorations become overlays (`migrateProjectDecor`), and stripped built-in typography is recovered.
- **Service version:** `/api/health` reports the project version and top effect engine it supports. The editor refuses to save through an older service.
- **Rename:** the app was called FrameForge. `.frameforge/` moves to `.kamikami/` automatically, the bundle envelope stays `frameforge-effect`, and the legacy `x-frameforge` request header is still accepted.

## Storage

All workspace data lives in `.kamikami/` and is gitignored. Writes are atomic.

| Path | Holds |
| --- | --- |
| `project.json` | The autosaved project (recovery copy) |
| `media/`, `library.json` | Imported media and its catalog |
| `analysis/` | Per-file analysis (`<sha256>.json`), `index.json`, `queue.json` and `settings.json` |
| `effects.json` | My effects and imported effects |
| `fonts/`, `fonts.json` | Imported fonts and the font catalog |
| `exports/` | MP4 exports, rendered PNG frames, and `views/` range renders |
| `assistant.json` | Assistant conversations and connection metadata (never the API key) |

- **Saving to a file:** header Save (⌘/Ctrl+S) writes the project JSON to a chosen file. Autosave only updates `project.json`.
- **Media and fonts aren't embedded:** project files reference workspace media and fonts, so move the whole `.kamikami/` folder with a project.
- **Undo:** history is in memory.

## Limits

Limits live in `LIMITS` (`src/model.ts`) and the schemas; agents read them from `get_capabilities` (`limits`, and the JSON schemas). They aren't repeated here so they can't drift.
