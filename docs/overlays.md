# Overlays

Requires `kamikami-visual-v8`. An effect with an `overlay` recipe (`src/overlays.ts`, drawn by `src/OverlayLayer.tsx`) draws vector marks around any visual element — text, images, video, shapes, scenes and backdrops. Overlays are one engine for both: every kind is a pure function from the element's box and time to SVG parts, so previews and exports draw the same frame.

## Placement and units

- On text the box is the measured text block (from `textGeometry`); on pictures it is the visible artwork box (an image's contain-fitted size, a shape's size, or the full frame). Marks follow the element's transform.
- `anchor` marks the whole element, the **key word** (the longest word) or, for underline, highlight and strike, **each line**.
- `placement: auto` puts labels, arrows, callouts and marks on the side of the element with the most free space in the frame.
- Units: 1 em on text; 2.5% of the frame's shorter side on pictures. Sizes take the larger of a title-sized minimum and a fraction of the box, so a mark reads on a title and scales with a full-frame picture.
- Parts can sit behind the element (print, shadows, highlighter, crosshair, speed lines, impact) or in front.

## Timing

`timing` is `envelope` (draw on over `seconds` at the start, retract at the end), `in`, `out` (draws near the clip end so the element can still leave after the mark lands, as in **Cross out**) or `constant`. Strokes draw on with `pathLength` dashes. `wobble` makes lines hand-drawn; `boil` redraws them several times a second like pencil animation. Everything is seeded and deterministic.

## Kinds

| Feel | Kinds |
| --- | --- |
| Frame | print, shadowblock, offsetframe, brackets, cropmarks, label, tape |
| Annotate | circle, underline, highlight, strike, arrow, tick, cross, star |
| Drafting | dimension (pixel readout), crosshair (position readout), ruler, callout |
| Print | registration (three plates slide into register), colorbars, stamp |
| Energy | speedlines, impact (a comic burst ring), sparkle |

**Cross out** (Out role) is a strike overlay timed `out` plus a short opacity channel at the clip end.

## Migration

The framing kinds were artwork treatments (`art.kind`) and two text looks (`brackets`, `label`). `validateProject` and `EffectBundleSchema` convert those definitions, and per-instance snapshots, to overlays; artwork distances become `pad` at `distance / 0.025`.
