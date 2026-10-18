# Editor

## Layout

- **Header:** New project (asks for a name, size and frame rate, which are fixed from then on), Open project, the project name (opens project settings: name, length, export loudness; shows the format), theme picker (Original, Olive, Daylight, Dusk), Undo/Redo, Save, Export video.
- **Library (left):** Media and Effects tabs. Drag the divider to resize it; double-click resets the width.
- **Canvas:** the preview. It fits its window.
- **Timeline:** tracks and clips, plus a toolbar with Text, Shape, Backdrop, Split, snapping toggle and zoom (1–8×; the factor button fits the timeline).
- **Right panel:** Inspector for the selected element and its applied effects, and Assistant (see [assistant.md](assistant.md)).

## Shortcuts

| Where                | Keys                                                                                                                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Global               | ⌘/Ctrl+S save · ⌘/Ctrl+Z undo · Shift+⌘/Ctrl+Z redo · Backspace delete selected · Shift+Backspace ripple delete                                                                                                                           |
| Canvas               | Click to select, Shift-click to add · drag to move · corner handles scale · round handle rotates (Shift snaps 15°) · arrows nudge 1 px (Shift 10) · Alt bypasses snapping · double-click text to edit (⌘/Ctrl+Enter applies, Esc cancels) |
| Timeline ruler       | Click or drag to scrub · arrows one frame (Shift one second) · Home/End                                                                                                                                                                   |
| Clips                | Drag to move (vertically to change track) · drag an edge to trim · focused clip or edge: arrows one frame (Shift one second) · Esc cancels a drag · Alt bypasses snapping                                                                 |
| In/Out phase handles | Drag to retime a clip's entrances or exits together · arrows one frame (Shift 0.1 s)                                                                                                                                                      |
| Track grip           | Drag, or Up/Down, to reorder tracks                                                                                                                                                                                                       |
| Dropdowns            | Arrows, Home/End, type to jump, Enter, Esc                                                                                                                                                                                                |

Split cuts selected clips at the playhead, keeping at least three frames on each side. Each drag is one undo step.

## Elements

- **Text:** a font picker with bundled families (`public/fonts/builtin`) and system fonts, with search, categories, favorites, recents and live previews. Imported TTF, OTF, WOFF or WOFF2 fonts are stored per workspace; missing fonts block export until replaced.
- **Shapes** (+ Shape): presets built from the kinds in `shapeKinds` (`src/shapes.ts`), with size, radius, sides, fill and outline. Shapes behave like images.
- **Backdrops** (+ Backdrop) are full-frame and animated, each on its own track.
  - Backgrounds (`backgroundKinds`, `src/backdrops.ts`) sit under everything.
  - Finishes (`finishKinds`) sit on top and blend with everything below.
- **Busy tracks:** if the selected track is busy at the playhead, new text and shapes go on a new track.
- **Fades:** every element has `fadeIn`/`fadeOut`. Audio edges get automatic 20 ms de-click ramps.
- **Mute/solo:** works on audio and video tracks.

## Media

- **Import:** media is copied into `.kamikami/media/`. Drag a card onto a track at a time; drops snap to frames and fill the gap up to the source length. Importing alone doesn't change the project.
- **Formats:** browser codecs decide what previews. MP4/H.264 and standard image formats are safest.
- **Analysis:** imports aren't analyzed automatically. **Analyze** (whole library) or a card's status badge (one asset) shows an estimate, then runs the chosen tier; **Details** shows the transcript, shots and description. See [media-analysis.md](media-analysis.md).
- **Missing and deleted media:** Refresh checks for missing files. Relink replaces every reference in one undoable edit; the replacement must be the same type and long enough. Deleted media goes to Media trash and can be restored.

## Effects gallery

- **Roles:** tabs for All, In, Throughout, Out, Overlay, Style, Arrange, Between and Finish. Each role groups its cards by feel. See [effects.md](effects.md).
- **Filters:** search, plus a target filter (any element, fits text, fits pictures). Cards that can't apply to the current selection dim and say why.
- **Previews:** hover or focus a card to play a six-second preview on a dark stage. Out cards loop just the clip end. Reduced-motion users opt in with Play.
- **Applying:**
  - Drag a card onto a clip, or press Enter on a card to apply it to the selection.
  - Click an applied effect to edit that instance; the preset picker loads a named variation.
  - Double-click a library card to view it and **Fork** a copy into My effects.
  - My effects can be edited, forked and deleted.
- **Sharing:** **Export effects** saves any mix of My effects and imported effects as one pack file (`.kamikami-effects.json`) with a name, author and description. Shared effects are free for anyone to use and share. **Import effects** takes several files at once, packs or single-effect bundles. An imported pack is its own entry in the collection filter, where its header exports it again or removes it. See [effects.md](effects.md#bundles-and-packs).
- **Keyframes:** each Inspector property has a stopwatch, ◀ ◆ ▶ navigation and an easing menu. **Animate parameter…** keys any numeric effect setting. Diamonds on clips can be clicked to seek or dragged to retime. See [project.md](project.md#keyframes).

## Safeguards

- Shortening the project lists the clips that will be trimmed or removed and asks first. Undo restores them.
- New project asks to Save, Don't save or Cancel if there are unsaved changes.
- Invalid numeric entries stay visible with an explanation. Esc restores the field.
- Effect settings are drafts. Save changes is one undo step; Cancel or Esc discards.
