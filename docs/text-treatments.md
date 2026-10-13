# Text treatments and backdrops

Requires `kamikami-visual-v8`. Every piece is independent and stacks with the others, so a shot is built by combining a motion, a treatment, decorations, a background and a finish.

## Text treatments (Text treatments category)

Each is a text effect kind in `src/text-looks.ts`; cards are in `src/builtin-effects.ts`.

- **Paint** (`lookPaint`): outlined, keyline, doubleline, extrude, longshadow, offset, neontube, chrome, sticker, stack, halftone, accent. Text shadows from several treatments are joined into one stack; strokes use `-webkit-text-stroke` with `paint-order: stroke fill`; fills use background-clip gradients.
- **Copies** (rendered in `AnimatedText`): ghost (flat copies re-rendered a few frames earlier, so they trail any motion), reflection, cutshift (the text cut into two clipped halves that slide apart).
- **Decorations** (`blockDecor`, `wordDecor`): wordbox, plate, rules, ticker, tape, burst. They are drawn behind the glyphs inside the text box and follow it. Corner brackets and the index label are [overlays](overlays.md) now; saved text looks of those kinds migrate on load.

`seconds` and `stagger` time the draw-in; `color`, `secondary`, `angle` and `distance` tune each kind.

## Backdrops

A `backdrop` element (`src/backdrops.ts`, rendered by `src/BackdropArt.tsx`) fills the frame with procedural, time-based art. Backgrounds (gradient, rings, halftone, rays, stripes, dots, stars, bars, scan, grid, ticker, split) are added on a new bottom layer; finishes (grain, scanlines, vignette, leak) on a new top layer with a blend mode. They take transforms, effects and keyframes like other elements. Projects with backdrops are version 3.
