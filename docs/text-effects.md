# Text effects

An `effect.text` recipe animates or decorates a text (`title`) element. It applies to text only. `TextEffectSchema` is in `src/text-effects.ts`, and rendering is in `src/AnimatedText.tsx`.

- **Positions:** motions use real letter and word boxes, measured from the loaded font with canvas metrics, including letter spacing. Without a browser, an estimate keeps the same motion. Lines are centered in the block.
- **Stacking:** text effects layer onto the same per-letter spans, so kinds stack with each other, with keyframes and with channel or pass effects.

## Shared settings

| Setting | Meaning |
| --- | --- |
| `seconds` | Entrance (or exit) duration |
| `stagger` | Delay between units |
| `unit` | `character` (each letter), `word` (rigid words; hinges pivot the word), or `title` (the whole block) |
| `motion.order` | `forward`, `reverse`, `random`, `center` (out from the middle) or `edges` (in from both ends) |
| `motion.direction` | `out` plays an entrance backwards over the clip end, as an exit |
| `tempo` | BPM for holds and beat kinds. Use the song's tempo on every beat effect so elements hit together; beats count from the project start |
| `color`, `secondary`, `distance`, `speed`, `angle`, `direction`, `variant` | Per-kind meaning; see `describe_effect` or the editor labels in each engine file |

## Kind families

| Family | Kind list | Engine |
| --- | --- | --- |
| Base | `textEffectKinds` in `text-effects.ts` | v4–v5 |
| Title animations, line sequences | `titleKinds`, `sequenceKinds` in `title-effects.ts` | v7 |
| Kinetic entrances, exits, holds | `kineticKinds` in `kinetic-type.ts` (`kineticRole` sorts them) | v8 |
| Treatments (paint, copies, decorations) | `lookKinds` in `text-looks.ts` | v8 |
| Layouts (unit word) | `layoutKinds` in `text-layouts.ts` | v8 |

Each engine file also holds the kinds' names and control labels. Agents get the same through `find_effects` and `describe_effect`. Some card IDs differ from their kind: `kinetic-roll` uses `wheel`, and `kinetic-burst` uses `blast`.

## Behavior notes

- **Holds** ease in once the element's longest entrance has nearly finished, and ease out before its earliest exit. The basic lyric-line recipe is entrance + hold + exit on one element.
- **Shards:** gather, blast and crumble cut each glyph into six seeded triangles. Copy-based kinds (shards, plates, channels) hide the original glyphs with a clip rather than opacity, so the copies stay visible.
- **Plates and channels:** plates shows offset cyan/magenta/yellow copies sliding into register. Channels splits the text into red/green/blue copies that drift apart.
- **Layouts:**
  - A layout computes a placement for each word (position, scale, rotation) plus an entrance. `amount` interpolates from the normal line to the arrangement.
  - Layouts are applied before kinetic motions, so a motion still plays on top.
  - giant draws the longest word huge, cropped and behind the line. swap shows one word per beat, then assembles the line. seesaw is a hold.
- **Treatments:**
  - Paint uses stacked text shadows, `-webkit-text-stroke` with `paint-order` and gradient fills.
  - Decorations draw behind the glyphs inside the text box.
  - Ghost re-renders the text a few frames earlier, so it trails any motion.
  - Rules, ticker, tape and burst are sorted under the Overlay role in the gallery.
- **Titles:**
  - Masks clip a fixed box while the glyphs travel through it.
  - Highlight and underline join per-letter sweeps into one bar.
  - Draw strokes an SVG outline, then fills it.
  - Count rewrites every number in the text.
  - Circle lays a single line around a rotating ring.

## Limits

- Slot reels and horizontal masks clip at each glyph's box.
- Stroke-draw outline length is estimated, so complex glyphs such as CJK may still be drawing when the fill appears.
- Circle text expects one line. Number count changes the text width while counting; tabular-figure fonts avoid jitter.
- The bundled Japanese lyric faces are Latin-only subsets.
