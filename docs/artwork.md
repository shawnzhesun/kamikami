# Artwork treatments

Requires `kamikami-visual-v8`. An effect with an `art` recipe (`src/artwork.ts`, rendered by `src/ArtworkLayer.tsx`) treats an image, video, shape, scene or backdrop. Every card in the **Artwork** category (shown under the Throughout, In and Out roles) is one independent piece; stack them with each other and with any other effect.

## Camera and beat (any visual element, including text)

Added to the element's transform in `layerAtTime`, so selection boxes follow them.

- **drift** — layered slow sines at seeded rates; overscans by `distance × 2.4` so full-frame art never shows its edge.
- **punch** — a scale hit on each beat (25 ms attack, exponential decay over `seconds`).
- **jolt** — a knock in a new seeded direction each beat that rings back.
- **strobe** — inverts the element on every `count`-th beat for `seconds`.
- **stutter** — holds the element's clip time to whole steps (`count` per second), so keyframes, effects and text animation move like stop-motion. Video frames themselves keep playing.

Beat kinds count beats from the **project start** at `tempo` BPM, so every element on the same tempo hits together whatever its clip start.

## Copies (artwork only)

- **trail** — up to four copies rendered at `t − lag × k`, offset along `angle`, luminance-tinted with `color`/`secondary` through an SVG color matrix and screen-blended under the element. They trail any motion: keyframes, drift, punch.
- **slices** — the element drawn as 2–12 clipped bands that knock sideways on the beat, slide together at the clip start (`in`), apart at the end (`out`), or drift continuously.

Copies of video are muted; slices of video decode the clip once per band, so keep the count low for video.

## Framing

The framing kinds (print border, block shadow, offset frame, corner brackets, crop marks, index label, tape corners) are now overlays, so they work on text too. Saved projects and bundles that used them as `art` kinds migrate on load. See [overlays](overlays.md).
