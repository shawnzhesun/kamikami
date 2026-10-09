# Case study: can KamiKami re-create videoplayback.mp4?

October 9, 2026. Source: `/Users/shawn.sun/Downloads/videoplayback.mp4`, 1920 × 1080, 29.97 fps, 3:08.9, **video only (no audio stream)**. It is the "Children Record Re:boot" lyric music video: photo plates under heavy color grading, flat-colored illustrated characters, manga panels and dense Japanese kinetic typography. The two earlier studies ([effects](videoplayback-effects.md), [motion](videoplayback-motion-design.md)) catalogued its effect vocabulary. This one asks whether the **whole film** can be rebuilt with the current app, now that keyframes and the [v6 effects](style-effects.md) exist.

Method: ffmpeg scene detection (threshold 0.32), contact sheets at 2-second intervals over the full runtime, and 5 fps sequences at 0:31–0:35 and 2:33–2:37. Times are approximate.

## Verdict

- **Effect vocabulary: mostly sufficient.** About 80–85% of the visible treatments now have a direct recipe (grades, remaps, glitches, smears, repetition, particles, flashes, halftone, rings, text glitch/blur, camera moves). Keyframes now cover the hand-timed motion that curve recipes couldn't (clock hands, panel pans, per-phrase fades and blurs).
- **Re-creating the film in one project: not feasible today.** The blockers are structural, not effect-related: the **40-element project limit**, no masks or track mattes, no blend modes, no shape or solid layers, and no vertical or stroked text. Artwork, characters and the song must be supplied as media.
- **Feasible with a segment workflow.** Build roughly 10 segment projects of about 20 s each, export them, then assemble the MP4s in a final project. This works today, but it's laborious and some looks stay approximate (listed below).

## Structure of the film

| Measure | Value |
| --- | --- |
| Detected shot changes | **92** (median shot 1.45 s; 26 under 0.5 s; 6 over 5 s) |
| Cuts per 30 s | 16, 16, 10, 18, 11, 9, 11 |
| Lyric phrases | about 150–180; a new phrase every 0.5–1.5 s while singing |
| Estimated elements needed | about **300–450**: ~92 backgrounds + ~150–180 lyric elements + ~60–100 cutouts, overlays, panels and shapes |
| App limits | 40 elements, 40 effect definitions, 8 effects per element, 24 fps, 1920 × 1080, 10 min |

## Coverage matrix

✅ direct recipe · ◐ approximation or workaround · ✗ not possible

| Treatment (examples) | Status | How in KamiKami |
| --- | --- | --- |
| Red monochrome / duotone photo plates (0:04–0:20, 2:02–2:08) | ✅ | Color grade (two-color), Color remap, Print grain |
| Negative / posterized / hue-shifted plates (0:22–0:28, 0:44, 2:12) | ✅ | Color remap (negative/solarize/posterize, hue cycle) |
| RGB-split and glitch accents on cutouts and plates (0:08, 0:33, 2:18, 2:35) | ✅ | Chromatic fringe, Broken TV signal (blocks), Text glitch for lyrics |
| Zoom/spin smear transitions (0:34, 2:22) | ✅ | Motion smear (In timing), Impact zoom |
| Phrase-by-phrase lyrics that blur and fade out (0:31–0:35) | ✅ new | One text element per phrase; keyframe Opacity, plus Focus pull with an end-aligned channel span (v6) or keyframed blur parameter |
| Big translucent ghost kanji behind the lyric (0:32–0:35, 2:54) | ✅ | Large text element at low opacity; Cutout echoes |
| Repeated grids of a glyph/sign (戦 at 0:44, 赤 at 2:54) | ✅ | Image repetition (grid), or Glyph field for text |
| Kaleidoscope / radial hands (1:14, 2:52) | ◐ | Image repetition (kaleidoscope). The different hands are separate artwork |
| Fireworks (2:24–2:28) | ✅ | Particles · Depth fireworks / Radial bursts |
| Clock hands rotating (2:40–2:44) | ✅ new | Separate hand images with Linear rotation keyframes |
| Manga panel pans and pushes (1:54–1:58) | ✅ new | Keyframed X/Y/Scale with Easy ease |
| HUD rings and interface panels (1:04–1:06) | ◐ | Graphic rings + bloom; panels, arrows and "Go!" plates are imported artwork |
| Halftone dot texture and diagonal stripes (2:34–2:38) | ◐ | Print screen (dots). Stripes must be imported images; no shape layers |
| Diagonal scrolling text bands (2:34–2:38) | ◐ | Rotated text with linear X keyframes. No text background box or band clipping |
| Floating translucent panels in perspective (0:02) | ◐ | Depth motion / Angled picture plane per panel image |
| Character cutouts with flat recoloring (0:20, 1:40) | ✅ | Color silhouette, Comic ink for line treatments |
| Snowy white flash / exposure (0:42, 2:52) | ✅ | Color flash, Soft highlight bloom, Scene light |
| Inset picture frames (1:50) | ◐ | Scale an image element. No crop, rounded rectangle or border |
| Solid color title cards (3:00–3:04, 0:30) | ◐ | No solid layer; import a 1-pixel PNG and scale it to fill (×1.78, since images fit inside 1080 × 1080). The composition background is fixed near-black |
| Vertical (tategaki) lyrics and credits (0:36, 1:44–1:46, 3:06) | ◐ | Newline after each character stacks CJK glyphs vertically. No `writing-mode`, so punctuation and Latin glyphs are not rotated |
| Outlined text and text with an image inside (0:38 "した", 0:00 少) | ✗ | No text stroke, no text-as-mask or track matte. Only alpha-based Color silhouette (outline) on the text |
| Circle backdrop shapes (0:31–0:35) | ◐ | Import a circle PNG; no shape layers |
| Glyph "rain" columns over plates (0:22–0:26) | ◐ | Glyph field is a 3D volume/tunnel, not falling columns; render it as an imported video |
| Flowing scarf / hair, character acting (0:54–0:56, 2:46) | ✗ | Frame-by-frame animation is content. Import it as video; transparent WebM is untested |
| Mirrored split screen (1:20–1:22) | ✅ | Image repetition (mirror) or a duplicate element |
| Music and cut sync | ✗ | The source has no audio. The app has no markers or beat detection, so sync is placed by hand |
| 29.97 fps cadence | ◐ | Projects are fixed at 24 fps, so conforming changes the cadence and stepped or held-frame timing must be re-timed by hand |
| Japanese typefaces (Mincho/Gothic) | ◐ | No bundled CJK font. Import a TTF/OTF up to 20 MB (Noto Sans JP fits) |

## Example recipe: 0:31–0:35 ("白い / イヤホンを / 耳に当て")

1. Background: a gray-green plate image with Color grade (Midnight teal, low saturation).
2. Circle backdrop: an imported circle PNG with Scale keyframes from 0.9 to 1.0, Easy ease.
3. Character: a purple cutout PNG. Chromatic fringe with Strength keyframed 0 → 1 → 0 around 0:33.2. Motion smear (zoom, In timing, 0.4 s) on its second clip after a split at 0:34.
4. Lyrics: one text element per phrase on two alternating layers (same-layer elements can't overlap). Each gets Opacity keyframes 1 → 0 over its last 0.25 s, and Focus pull forked with an end-aligned blur span (from 0 to 22 over 0.3 s, align end).
5. Ghost kanji: a large "耳" text element at opacity 0.25 behind the phrase.

That is 10–12 elements for four seconds, which shows why the 40-element cap dominates.

## What would make a full re-creation practical (prioritized)

1. **Nested compositions (precomps) or a much higher element limit.** This is the single biggest blocker; segment exports are a stopgap.
2. **Masks and track mattes:** alpha/luma matte from the layer above, plus shape masks including text-as-mask. These unlock image-in-text, inset frames, band clipping and iris-style reveals on arbitrary shapes.
3. **Shape and solid layers:** rectangle, ellipse, polygon and stripes, with fill, stroke, corner radius and trim paths.
4. **Per-element blend modes:** screen, multiply, overlay, add, difference.
5. **Text styling:** vertical writing mode, stroke/outline, letter and line spacing, background box, per-line alignment, ruby.
6. **Frame-rate setting** (30/29.97/24) and **timeline markers with audio beat detection** for lyric sync.
7. **Crop**, verified **alpha video** import (WebM VP9 alpha / ProRes 4444) for character animation, and an optional bundled Noto Sans/Serif JP.
8. A keyframe graph editor and spatial motion paths for the HUD and camera moves.

Effect gaps worth adding after those: falling glyph rain (a falling-columns layout for the glyph field), a text background box/stripe, and a radial speed-lines burst.
