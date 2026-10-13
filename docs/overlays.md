# Overlays

Requires `kamikami-visual-v8`. An effect with an `overlay` recipe draws vector marks around any visual element — text, images, video, shapes, scenes and backdrops. One engine serves both: every kind is a pure function from the element's box and time to SVG parts, so previews and exports draw the same frame.

- `src/overlays.ts` — schema, the kind list, timing, anchors, entrances, loops and placement.
- `src/overlay-kinds/*.ts` — the kinds, one file per gallery section (`overlayKinds` is the list). Each kind is a spec: name, section, defaults, control labels, shape variants and a `draw(ctx)` function.
- `src/overlay-kit.ts` — shared geometry (curves, arcs, polygons, arrowheads) and the drawing context.
- `src/overlay-style.ts` — the shared line and fill styles.
- `src/OverlayLayer.tsx` — the SVG renderer (patterns, glows, chalk grain, draw-on masks, wipe clips).
- `src/overlay-cards.ts` — the gallery cards and their variations.

## Placement and units

- On text the box is the measured text block (from `textGeometry`); on pictures it is the visible artwork box. Marks follow the element's transform.
- `anchor` marks the whole element (`block`), the **key word** (the longest word), **each line**, **each word**, or the **first letter** (`initial`). Underline, highlight and strike follow lines themselves. Every other kind repeats once per line or word, drawing one after another with `stagger`.
- `placement: auto` puts labels, arrows, callouts and badges on the side with the most free space in the frame.
- Units are 1 em on text and 2.5% of the frame's shorter side on pictures. Sizes take the larger of a title-sized minimum and a fraction of the box, so a mark reads on a title and scales with a full-frame picture.
- Parts sit behind the element or in front of it as the kind designs. `layer` overrides that, and `offsetX`/`offsetY` (units), `rotate` and `mirror` move the whole mark. Mirrored labels stay readable.
- **Thread link** joins the element to the nearest other element on screen; `count` picks the second-nearest and so on. The renderer passes the centers of the other visible elements as `target.peers`.

## Timing and motion

- `timing` is one of:
  - `envelope`: draws on over `seconds` at the start and retracts at the end.
  - `in`: draws on at the start and stays.
  - `out`: draws near the clip end, so the element can still leave after the mark lands (as in **Cross out**).
  - `constant`: always shown.
- `enter` chooses how the mark arrives (`draw` is the kind's own draw-on; others fade, pop, slide…). `exit` is `match` (the entrance played backwards) or any entrance style.
- `loop` adds motion while the mark is shown. Loops are timed to `tempo` (BPM) and sized by `loopDepth`. Use one tempo per song so marks hit with beat-timed motions.
- `wobble` makes lines hand-drawn and `boil` redraws them several times a second, like pencil animation. Everything is seeded and deterministic.

## Shared styles

Every kind takes the same style fields from `OverlaySchema` (`src/overlays.ts`), so any line style or fill works on any mark. `describe_effect` lists them with their options; the groups are:

- **Line:** `stroke` (plain, hand-drawn, brush, chalk, dashed, neon and more), `roughness`.
- **Fill** (closed shapes): `fill` (as designed, none, solid or a pattern), `fillColor`, `fillOpacity`, `density`.
- **Look:** `blend`, `shadow`, label `font` and `caps`, and `variant`, the kind's own shape list (balloon types, badge shapes, palettes…).
- **Labels** fill in live readouts such as `{time}`, `{pct}` or `{word}`; the full list is in the `label` setting's description.

Styled lines draw on through a mask along their centerline, so draw-on works for every style. Fills of outlines that surround the element go behind it, so hatching never covers the words. With pencil or sketch lines, hatching and dots are drawn by hand as well.

Kinds and their variants are browsed with `find_effects role:"overlay"` (feels are the gallery sections) or in the Overlay tab. **Cross out** (Out role) is a strike or scribble timed `out`, plus a short opacity channel at the clip end.

## Sources

- The hand-drawn line and hatching styles use [Rough.js](https://roughjs.com) (MIT).
- Marker, brush and chalk strokes use [perfect-freehand](https://github.com/steveruizok/perfect-freehand) (MIT).
- Path measuring uses `@remotion/paths`.

Both libraries are seeded and tuned for pixel coordinates, so paths are scaled up to stroke-sized pixels and back. The annotation set draws on [Rough Notation](https://roughnotation.com). The kinds are our own designs, informed by:
- manga iconography: focus lines, sweat drops, the anger vein, gloom lines;
- After Effects HUD and broadcast packs;
- Memphis and Bauhaus graphics.

## Migration

The framing kinds were artwork treatments (`art.kind`) and two text looks (`brackets`, `label`). `validateProject` and `EffectBundleSchema` convert those definitions, and per-instance snapshots, to overlays; artwork distances become `pad` at `distance / 0.025`. The shared style fields have defaults, so earlier overlay definitions keep drawing the same marks.
