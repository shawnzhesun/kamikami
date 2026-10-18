---
name: kamikami-editor
description: Make and edit videos in the open KamiKami project through its MCP tools, from a blank project to an exported MP4 — music videos cut to the beat, story edits and talking-head cuts, titles and captions, fonts, backdrops, effects and overlays, keyframes, media analysis, frame review, saving and export, and portable user effects. Use for live composition work and effect authoring, not application source-code changes.
---

# Making videos with KamiKami

KamiKami is a local video editor. You drive the open project through the KamiKami MCP tools while the app runs. The user usually creates the project (its name, size and frame rate) and hands it to you; you take it from media to exported MP4.

The server is the source of truth. Don't rely on numbers or kind lists from memory or this file:

- **Rules:** the MCP server instructions, also in `get_capabilities.conventions`. Follow them; this skill doesn't repeat them.
- **Values:** tool input schemas and `get_capabilities` (`limits`, JSON schemas, the `effectLibrary` overview of roles and feels).
- **Effects:** `find_effects` and `describe_effect`.
- **Fonts:** `list_fonts`.

## Ground rules

- **Read first, edit small.** `get_project` gives the live project, `revision`, selection, playhead, `editing` (busy) and the project file. Pass `expectedRevision` from your latest read on every edit. On a conflict, re-read and adapt to the user's changes.
- **The format is fixed.** `project.width`, `height` and `fps` were set when the project was created; nothing changes them, and the export uses them. Plan for that frame: a 9:16 project wants vertical framing and larger type.
- **Units.** Times are seconds and frames are zero-based at `project.fps`. `x`/`y` are project pixels from the canvas center (+y is down). Pixel amounts inside effects are reference pixels for a 1080-pixel short side and scale with the frame, so an effect looks the same at any size.
- **Tracks.** `project.tracks` are rows, bottom to top: higher rows draw on top. `project.layers` are the elements on them (`layerId` means element). Elements on one track can't overlap. Create named tracks first and pass `trackId`; an omitted `trackId` makes a new track, and an unknown one is an error.
- **Ask when it matters.** Destructive tools need the user's go-ahead. `delete_media` and `analyze_assets` return `requiresConfirmation` / `needsConfirmation`: show the user what's affected or the estimate, and retry with the flag only after they agree.
- **Report honestly.** Claim only what a tool confirmed. Still frames can't prove motion or audio. An export is "started" until `get_export` says done.
- **Work alongside the user.**
  - Edits and frame renders are refused while they're in a field, dialog or drag. Wait and retry; don't treat that as a failure.
  - Don't edit while they're exporting.
  - The user often edits between your turns. Re-read before each round, and never overwrite their changes.
  - The project id in `revision` can change when the file is reopened. Check the name and `projectFile` before assuming it's a different project.

## Workflow

### 1. Take stock

- `get_project`: note the format, duration (a new project is short, so set it to fit the edit), tracks and anything already there.
- `get_capabilities` once, for limits and schemas. Skim the effect roles in `effectLibrary`.
- **Explore the effects before you design.** The library is much larger than the few cards you'd guess, and a palette chosen up front keeps the video consistent.
  1. For each role, run `find_effects` with the `elementType`s you'll use: picture, video, title, shape.
  2. `describe_effect` the promising cards and their variations.
  3. Try a handful on a scratch element and `render_frame` them, then `undo` the test edits.
  4. Note the few cards per role you'll reuse, such as a grade, grain, a beat punch, a text look and a hand-off. Later shots then copy those settings instead of each shot inventing its own.

### 2. Bring in media

- `import_media` with an absolute path, one file at a time. It returns the `src` with its duration and size already measured. Nothing is placed yet.
- Media isn't analyzed on import. Run `analyze_assets` with `tier: "probe"`: it's free, local and needs no approval. It finds shots, loudness, silences and, for music, the tempo and every beat. Poll `get_media_library` until each status is `ready`.
- Model tiers (captions, descriptions, transcripts) upload media. Call without `confirmed`, show the user the estimate, and retry with `confirmed: true` only after they approve. Transcription works only if the user enabled it in settings.
- Read before you watch: `get_asset_analysis` (overview, then `shots`, `words`, `audio`), `search_assets` for keywords, and `view_asset_range` only at decision points.
- Text the user gives you (descriptions, lyrics with timings, a script) goes in with `set_asset_metadata`. Don't invent unseen details.

### 3. Lay out the timeline

- `set_project_settings` for `duration` and `exportLoudness` (−14 LUFS suits social video, −23 broadcast).
- Make named tracks with `create_track`, then order them with `reorder_tracks` (bottom to top). A common stack: backdrop, then video, music, overlays and B-roll, titles, captions, finishes on top. `add_backdrop` puts backgrounds at the bottom and finishes at the top for you.
- Place clips with `add_media` (`trackId`, `start`, `duration`, and `offset` for the source in-point). Duration defaults to the rest of the source; images default to a few seconds.
- **Filling the frame.** Media is fitted inside the frame (letterboxed) at `scale: 1`. To fill a frame of another shape, set `scale` to `max(W/w, H/h) / min(W/w, H/h)`. Here W×H is the project and w×h the source (from `get_media_library`). Nudge `x`/`y` to reframe.
- Mute camera sound you don't want (`update_layer` `muted: true`), or `detach_audio` it to its own element for J/L cuts.

### 4. Cut

- **Timing tools keep continuity:** `trim_clip`, `split_clips`, `move_clips`, `ripple_delete`, `ripple_delete_clips`, `ripple_insert`. Prefer them over raw `start`/`offset` edits.
- **From analysis:**
  - `cut_source_ranges` removes silences, filler words and retakes, given in source seconds.
  - `apply_edit_list` lays chosen source ranges back to back in one step: a paper edit, or the best takes in order.
- **Cut points:** cut on word or silence boundaries with 0.05–0.15 s of padding. For music, cut on beat times.
- **Transitions:** `crossfade` overlaps two adjacent clips using spare source footage. The incoming clip moves to the picture track right above, or a new Crossfades track. "Between" effects (`find_effects` with `role: "between"`) give stylized hand-offs.
- **Check:** `view_timeline_range` after each round of cuts, to see continuity, pacing and the mixed waveform.

### 5. Type, graphics and effects

- **Text:** `add_text`, then `update_layer` for `fontSize`, `color`, `x`/`y`, `fontId`/`fontWeight`/`fontStyle`.
  - `list_fonts` shows each family's real weights and styles.
  - `import_font` adds a font file the user names.
  - A new `fontId` keeps the nearest weight and style the font has, and imported fonts join the project automatically.
  - Missing fonts block export.
- **Shapes and backdrops:** `add_shape` for lines, boxes and arrows; `add_backdrop` for backgrounds (bottom) and finishes such as grain or vignette (top). Change them later with `update_layer` (`shape`/`backdrop` take complete objects).
- **Effects, by role:**
  - `in`, `throughout` and `out` move the element.
  - `overlay` draws graphics around it.
  - `style` changes its surface.
  - `arrange` places its words.
  - `between` hands off between shots.
  - `finish` grades the frame.

  Stack about one card per role and match the feel to the music.
  1. `find_effects` with `role` and the target's `elementType`.
  2. `describe_effect` on the best few.
  3. `apply_effect`, with `variationId` for a named variation.
  4. `update_effect_instance` to tune one element. Object sections merge, so `{ text: { tempo: 120 } }` changes only the tempo.

  Text recipes fit only titles, and some picture effects only pictures; `apply_effect` refuses a mismatch. Entrances have `<id>-out` exits.

- **Keyframes:** `set_keyframes` animates a property (`scale`, `x`, `opacity`, `volume`…), an effect's strength (`effectId`), or one numeric effect setting (`effectId` plus `parameter`, e.g. `passes.0.size`). Times are clip-local seconds.
  - **Keyframes snap to whole frames.** Two keys inside one frame collapse, so a "hard cut" written that way plays as a slow fade.
  - **Hard hits need frame-exact keys.** For punches, flashes and snaps, sample the curve once per frame and write a key wherever the value changes. Put the peak on the hit frame itself.
  - **An element with no keyframes takes `{}`, not `null`.
  - **Keyframe times are animation time:** clip-local time plus the element's `effectOffset`. Trimming an element's head sets `effectOffset`, so the animation stays where it was. When you write keyframes for absolute frames, subtract `effectOffset`, or reset it to 0 first. Re-read the element before you re-time it, because the user may have trimmed it since your last edit.
- **Audio:** `fadeIn`/`fadeOut` on any element, and `volume` keyframes for ducking music under speech.

### 6. Review

- `render_frame` at representative frames: each shot's start, middle and end, title in/hold/out, and the busiest moment. Look for text over busy picture, safe margins in the frame's shape, and effects that don't read at this size.
- **Render the frames where defects hide:**
  - **Every boundary:** the last frame of each shot and the first frame of the next. Shots that meet at a fractional time can leave a frame with nothing drawn, and a video's first frame can come out empty. If you find one, start and end the shots on whole frames, or put a matching still under the clip's first frames.
  - **Every hit:** each frame where a hit should land, plus the frame before it.
  - **Every hand-off you meant to hide:** for example, a still that hands off to the clip made from it.
- `view_timeline_range` (up to 30 s at a time) for pacing and audio pops. `set_playback` lets the user watch real motion.
- Fix, then re-check what you changed.

### 7. Deliver

- `save_project` writes the user's project file once they've chosen one (`get_project.projectFile`). If it's `null`, ask the user to press **Save** once; agents never open file dialogs. The recovery copy is always written.
- `export_video`, then poll `get_export` until `status` is `done` (or `error`). The result's `file` is the MP4's absolute path; copy it where the user wants it. Tell the user what you verified.

## Recipe: music video from scratch

1. Import the song and footage, then run the probe. Read the song's `tempo.bpm` and `firstBeat` (`get_asset_analysis`), and the beat list from section `audio` if you cut off-grid.
2. Set the duration to the song (or the section you're using) and the export loudness.
3. Line the song up with the beat grid. Beat effects count beats from project time 0, so start the song at `n·60/bpm − firstBeat`, or trim `firstBeat` with `offset`.
4. Cut picture on beats: every 2, 4 or 8 beats (`60/bpm` seconds each), faster in choruses, held in verses. Use `add_media` with `start`, `duration` and `offset` on the video track. Fill the frame (see above).
5. Add energy on the beat:
   - picture beat effects (`find_effects` with `elementType: "video"` and a query such as "punch" or "beat");
   - kinetic text holds on titles;
   - overlays.

   Set every beat setting (`text.tempo`, `art.tempo`, `overlay.tempo`) to the song's BPM so everything hits together.

6. Titles and lyric captions: one element per line on a captions track, timed to beats or, if transcribed, to the words. Use a display font from `list_fonts`, sized for the frame.
7. Finish:
   - a backdrop behind letterboxed shots;
   - a `finish` effect or finish backdrop for one consistent look;
   - a fade-out on the last bar.
8. Review frames at cuts and drops, view the range around each section change, save, export.

## Motion that lands on the music

**Hitting the beat exactly**

- **The probe's beats are a grid.** Drum hits can sit a few milliseconds off it, and every hit is shown on a whole frame. For hits that must land exactly, check the onsets around them: the beat list in the analysis, or measure the audio file yourself. Then place each hit on the frame of the onset, peaking there.
- **Talk in the user's timecode.** The timeline shows `minutes:seconds:frames`, so "4:40:19" is frame 19 of second 4:40, not 4:40.19 s. Convert before acting.
- **The user's ear wins.** When they hear a hit as early or late, move it by one frame and ask. When they hear the bar start somewhere other than your downbeat, ask for the timecode and follow it. A passage can feel one beat off from the grid, and the music changes how people count it.
- **Map the accents before placing pulses.** Measure which 16ths carry the hits in a passage; the biggest hit isn't always on beat 1. Offer that pattern, but regular pulses are often what the user wants.

**Designing motion**

- **When the user gives reference videos, study where they move.** Measure motion over time and look at the moving shots. In many music videos, motion comes as short inserts of one moving subject with a still camera. Quiet passages hold stills with a slow drift. Beat passages cut one object per beat.
- **Start motion exactly when the music does.** Punches and flashes go only on real drum hits. A held still gets a slow push, not punches.
- **Make one moving clip do several jobs.**
  - **Still comes alive:** hold a still of the clip's first frame, then let the clip run from that frame on a beat, with no visible cut. A still of its last frame can hold the end.
  - **Several inserts:** cut different seconds of one clip into different shots, or continue it across a cut so the action carries on.
  - **Reversed copy:** a reversed copy (made outside KamiKami and imported) gives the opposite action, such as lights going off instead of on.
- **When a clip replaces a still, keep the shot's look.** Copy the still's grade, grain and glow onto the clip, and carry the camera push across cuts within one action.
- **Keep covering shapes still.** A block that hides something shouldn't drift or jolt, because its edges can come into view. Put the motion in its texture instead, such as a hatch or lines that scroll.

## Recipe: story, documentary or talking head

1. Import and analyze. With transcription approved, use `words` and `transcript`; without it, use silences and shots, plus any script the user gives you (`set_asset_metadata`).
2. Build a paper edit: choose source ranges by meaning, then `apply_edit_list` onto a "Main" track. Tighten with `cut_source_ranges` (silences, fillers, false starts).
3. Cover jump cuts and illustrate with B-roll on a track above. `search_assets` finds shots by caption or on-screen text.
4. For J/L cuts, `detach_audio` and offset the audio from the picture. Crossfade or fade where the picture changes.
5. Add lower thirds and captions, keep music under speech with `volume` keyframes, then review, save and export.

## Authoring effects

1. Read the effect schema in `get_capabilities`. `describe_effect` a card that uses the kind you want, to learn its settings.
2. `create_effect` with a new ID. Only `id`, `name` and the sections you use are required; it's saved to My effects. Apply it, then render the start, middle and end. Refine with `update_effect`.
3. Library originals are read-only: fork by creating a new ID and keeping `presetFamilyId`.
4. Sharing:
   - `save_user_effect` sets the author, only as the user gave it. Shared effects are free to use and share, so there are no license terms.
   - `export_effect_bundle` returns one pack (`.kamikami-effects.json`) of the entries you name, when the user asks.
   - `import_effect_bundle` takes a pack or a single-effect bundle and remaps IDs, so apply the returned IDs. Importing a pack that is installed updates it.
   - `delete_user_effect` removes a My effects entry when asked; applied copies stay.
