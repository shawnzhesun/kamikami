# Roadmap

What isn't built yet, known issues, and the third-party sources that shaped the work. Earlier studies, surveys and plans were folded into this page and deleted; they remain in git history.

## Known issues

- **Test coverage:** `test:mcp:full` (live workspace) doesn't exercise the shape, backdrop, keyframe, analysis, ripple and effect-catalog tools. The unit tests cover the shared dispatcher, but not the MCP stdio round trip.
- **Re-analysis:** nothing flags an analysis as outdated when the analyzer changes; re-run `analyze_assets` to refresh.

## Editing and compositing

- Nested compositions, precomps and groups, including one camera shared across elements.
- Masks and track mattes (alpha or luma), shape masks, and text as a window onto media.
- Blend modes on any element; today only backdrops and overlays have them.
- Crop, and rounded or bordered inset frames.
- Vertical text, ruby, per-line alignment, and line spacing.
- Timeline markers; audio beat and BPM detection for lyric sync.
- A keyframe graph editor, spatial motion paths, roving keys, keyframe copy and paste, and keyframe presets. Colors, text and enums are not keyframeable yet.
- Verified alpha-video import (WebM VP9 alpha, ProRes 4444).
- A captions track built from transcript word timings.
- Two-clip transitions (crosswarp, morph, comparison slider).
- Speed changes, time remapping, freeze frames.

## Effects

- Particles emitted from an element's alpha (text dissolving into particles); true shutter-sampled motion blur.
- Expo, circ, quart and quint easing curves.
- Text candidates: shimmer swell, hatched line shadow, weight wave, scanline fuzz, viewfinder focus, line converge, selection dim, path marquee, letter-rearrange morph, blueprint lens.
- Reveal candidates: ragged or static-edge wipe, tile-flip grid, split slide, paper tear, push cut, channel-stagger fade for images, edge trace.
- Filter candidates: compound eye, swirl/twist/pinch, god rays, ASCII art, selective color, image drop shadow, blurred-fill backdrop.
- Overlays driven by audio: level meter, waveform ribbon, spectrum ring, kick rings. These need a per-frame loudness pass in analysis.
- Data visualization, credits roll, countdowns, code and LaTeX elements.

## Media analysis

- Local transcription (whisper.cpp) and a transcription capability check at connect time.
- Choosing an audio track for probing and transcription (track 0 only today).
- Subjects and motion in Look; frame de-duplication; embedding search.
- Progress events instead of polling; a cancel control in the UI and MCP.
- Shot thumbnails and word labels in previews; manual nudging of low-confidence lyric words; Details seeking the editor preview.
- Auto-subtitles, "remove ums", word-delete editing, B-roll matching.

## App

- Recent projects, Save As, named versions, and project bundles that include media.
- Export cancellation, a queue and history, destinations, reveal in folder.
- Agent audio review and automated visual evaluation.
- More model providers; managed sign-in and billing.
- A distributable installer (after replacing ffmpeg; see the README).

## Third-party sources

Effects are reimplemented from observed technique, and no code was copied. Libraries the code actually depends on are listed separately below.

| Source | License | How it was used |
| --- | --- | --- |
| [JIZURA](https://github.com/852wa/JIZURA) | MIT | Studied for kinetic type, layouts and decoration ideas; nothing copied |
| React Bits | MIT + Commons Clause | Ideas only; do not port code |
| Remotion source and templates | Source-available | Concepts and parameter values only |
| Motion Primitives, Magic UI, Motion Canvas, editly, PixiJS filters | MIT | Effect ideas |
| gl-transitions | MIT (InvertedPageCurl and StereoViewer are BSD) | Transition ideas |
| MotionVFX mTitle packs | Commercial | Motion vocabulary only; no assets |
| Manga iconography, After Effects HUD and broadcast packs, Memphis and Bauhaus design | — | Overlay design references |

- **Runtime libraries:** Rough.js (MIT), perfect-freehand (MIT), Remotion and `@remotion/paths` (Remotion license). Bundled fonts are SIL OFL (`public/fonts/LICENSES.txt`).
- **Notices:** if a formula is ever taken verbatim from an MIT source, add a NOTICES file.
