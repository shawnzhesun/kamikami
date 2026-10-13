# Overlays

Requires `kamikami-visual-v8`. An effect with an `overlay` recipe draws vector marks around any visual element — text, images, video, shapes, scenes and backdrops. One engine serves both: every kind is a pure function from the element's box and time to SVG parts, so previews and exports draw the same frame.

- `src/overlays.ts` — schema, the kind list, timing, anchors, entrances, loops and placement.
- `src/overlay-kinds/*.ts` — the 75 kinds, one file per gallery section. Each kind is a spec: name, section, defaults, control labels, shape variants and a `draw(ctx)` function.
- `src/overlay-kit.ts` — shared geometry (curves, arcs, polygons, arrowheads) and the drawing context.
- `src/overlay-style.ts` — the shared line and fill styles.
- `src/OverlayLayer.tsx` — the SVG renderer (patterns, glows, chalk grain, draw-on masks, wipe clips).
- `src/overlay-cards.ts` — the 76 gallery cards and their variations.

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
- `enter` chooses how the mark arrives: `draw` (the kind's own draw-on), `fade`, `pop`, `zoom`, `drop`, `slide`, `wipe` or `flicker`. `exit` is `match` (the entrance played backwards) or any entrance style.
- `loop` adds `pulse`, `spin`, `sway`, `bob`, `breathe`, `flicker` or `jitter` while the mark is shown. Loops are timed to `tempo` (BPM) and sized by `loopDepth`. Use one tempo per song so marks hit with beat-timed motions.
- `wobble` makes lines hand-drawn and `boil` redraws them several times a second, like pencil animation. Everything is seeded and deterministic.

## Shared styles

| Setting | Options |
| --- | --- |
| `stroke` | `plain`, `marker`, `pencil`, `sketch`, `brush` (pressure-tapered), `chalk` (grainy), `dashed`, `dotted`, `double`, `neon` (glow) |
| `fill` (closed shapes) | `auto` (as designed), `none` (outline only), `solid`, `hatch`, `crosshatch`, `zigzag`, `dots`, `halftone` |
| `fillColor`, `fillOpacity`, `density` | Fill color, opacity and pattern spacing |
| `roughness` | Pencil and sketch roughness |
| `blend` | `auto`, `normal`, `multiply`, `screen`, `overlay`, `difference` |
| `font`, `caps` | Label typeface (`mono`, `sans`, `serif`, `hand`, `element`) and capitals |
| `shadow` | A soft drop shadow, 0–1 |
| `variant` | The kind's own shape list: balloon types, badge shapes, wire solids, palettes and so on |

- Styled lines draw on through a mask along their centerline, so draw-on works for every style.
- Fills of outlines that surround the element go behind it, so hatching never covers the words.
- With pencil or sketch lines, hatching and dots are drawn by hand as well.

Labels fill in live readouts:

| Placeholder | Value |
| --- | --- |
| `{time}` | Clip time |
| `{start}` | Clip start |
| `{clock}` | Project time |
| `{length}` | Clip length |
| `{pct}` | Clip progress |
| `{index}` | The count, zero-padded |
| `{x}` `{y}` | Position on the frame |
| `{w}` `{h}` | Size in pixels |
| `{bpm}` | Tempo |
| `{text}` `{word}` | The element's text and its key word |

## Kinds

| Section | Kinds |
| --- | --- |
| Frame | print (square, rounded, deckled), shadowblock (block, extruded, stepped), offsetframe (count echoes), brackets (square, rounded, ticks), cropmarks, label, tape (count strips) |
| Annotate | circle (count loops), underline, highlight, strike, arrow (bowed, straight, loop), tick, cross, star (count points), box (loose, two passes, rounded, cloud), braces (curly, square, round, bar; placement picks sides), scribble (zigzag, loops, hatch), squiggle (wave, zigzag, loops, double; speed travels), swoosh (under, swatch, arc over, ensō), margin (!!, ?, asterisk, NB, margin bar) |
| Emotion | sweat (single, pair, flying), vein (vein, steam puffs, scribble cloud), blush (hatching, cheeks, hearts), gloom (hanging, wavy, rain cloud, dizzy spirals) |
| Comic | focuslines (wedges, hairlines, short ring), shake (arcs, ticks, zigzag), balloon (speech, thought, shout, whisper; label = words), badge (starburst, seal, ribbon, roundel) |
| Drafting | dimension, crosshair, ruler, callout, typeguides (cap, x-height, baseline and descender guides per line; thirds on pictures), selection (handles and size readout), anglearc (arc, protractor), dotgrid (dots, lines, crosses, isometric) |
| Interface | reticle (brackets, ring, diamond), scan (line, radar, framed), datacolumn (hex, telemetry, binary), progressring (dial, around, segments, bar; follows clip progress), bearing (compass, altitude ladder, timecode strip) |
| Paper | torn (strip, patch, two layers), photocorners (mounts, clear, lace), pin (round, thumbtack, paper clip), sticker (circle, label, star, heart), ticket (stub, postage stamp, coupon) |
| Ornament | quotes (curly, guillemets, corner brackets, single), flourish (diamond, curls, dots, double rule), footnote (a mark on the key word and a note at the foot of the frame), initial (boxed, rings, vines, block) |
| Broadcast | viewfinder (camcorder, minimal, cinema), safearea, sprockets (35 mm, Super 8, contact sheet), slate (clapper, hanging tag, camera tape), lowerthird (bar and kicker, underline and tag, box) |
| Print | registration, colorbars (process, grey ramp, broadcast), stamp (box, round seal, dated) |
| Geometry | orbit (rings, atom, Saturn; the far side passes behind the element), wireframe (cube, octahedron, pyramid, icosahedron), polygons, confetti (Memphis, mono, pastel), bauhaus (primary, mono, warm) |
| Energy | speedlines, impact (spiky, cloud, double), sparkle (four-point, six-point, plus, ring), shockwave (rings per beat), zap (bolts, crackle, single strike) |
| Atmosphere | glyphrain (the element's own letters fall), letterburst (letters fly out every beat), fireflies (fireflies, dust, bubbles, snow) |
| Connect | route (dot, plane, pulse), mappin (pin, flag, pulsing dot; label = place), thread (thread, dotted, leader) |

**Cross out** (Out role) is a strike or scribble timed `out`, plus a short opacity channel at the clip end.

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
