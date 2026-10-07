# Timeline layers and elements

Implemented October 7, 2026.

A layer is a named timeline row. It owns no source, timing, transforms, text or effects. Each element owns those properties and references its layer. A layer can contain mixed element types, multiple sequential elements, or no elements. The project currently retains its existing limits of 40 elements and 40 layers.

## Editing behavior

- Use the plus button beside LAYERS to create a layer. The settings button or double-clicking its name opens the layer dialog. Save/Cancel controls names; deletion is immediate and supports Undo.
- Drag a media card onto an empty time in a row. The drop time snaps to frames and nearby element edges/playhead; Alt bypasses edge snapping. The new element is shortened to the next element boundary or project end if necessary. Occupied times and gaps shorter than 0.1 seconds are rejected.
- Press Backspace to delete selected elements in one Undo step. Text inputs and open dialogs keep their normal keyboard behavior.
- Drag existing elements horizontally to change time and vertically to change layer. Multi-selection preserves relative layer positions. Invalid overlaps and selections extending outside the layer stack are rejected. Escape cancels a pointer gesture. The Inspector also provides a keyboard-accessible Layer selector.
- Text adds at the playhead on the selected layer, or creates a layer when none is selected. Split retains the containing layer and source/effect timing. Layer reordering moves the entire row in the composition stack.
- Click the project name for project settings. Shortening lists elements that will be trimmed or removed and requires explicit confirmation. Later elements are removed rather than piled onto the new end; Undo restores everything.
- The Inspector shows selected element properties and applied effects. A library effect's independent definition opens in a dialog. Effects are never implicitly applied to every element in a layer.

## Persistence and compatibility

For version-1 JSON/API compatibility, `project.layers` and the exported `Layer` type still describe **elements**. `TimelineElement` is their explicit alias. `project.tracks` stores independent named layers; each element has `trackId`. Validation migrates older projects and legacy creation commands to one layer per element, retaining IDs, content and visual order. Missing explicit track references, duplicate IDs and same-track overlaps are rejected. Empty tracks survive serialization and element deletion.

`orderedElements` is shared by the Remotion composition and canvas hit testing, so layer stack changes affect both playback/export and selection consistently. Effects, mute/solo, visibility, volume and transforms stay on elements. Track and element mutations share existing revision protection, autosave and Undo.

Legacy agent commands containing `layerId` or `layerIds` still target elements. New layer operations are `create_track`, `update_track`, `delete_track`, `reorder_tracks`. Add-text/media and move-clips commands optionally take a `trackId`. The native assistant and external MCP share all these schemas.

## Verification

`npm test` covers migration, independent persistence, gaps/overlaps, cross-layer/group moves, ordering, split continuity, layer deletion/Undo and native assistant confirmation. `npm run test:ui` exercises the real React editor in an isolated Chromium fixture on port 5174, with in-memory project/media APIs and no provider calls or personal workspace access. It also writes desktop/compact screenshots to a temporary directory. `npm run test:mcp:full` includes the four new layer tools and still requires an idle live editor.
