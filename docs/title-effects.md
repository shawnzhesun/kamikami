# Title animations

Added October 9, 2026: 20 looks on 16 Typography cards. The gallery now has 73 cards. Recipes use `kamikami-visual-v7`.

## Inspiration

The brief was to mimic the title packs listed at [motionvfx.com/elements?type=11](https://www.motionvfx.com/elements?type=11). That listing renders client-side, and the product pages (for example [mTitle Kinetic](https://www.motionvfx.com/store,mtitle-kinetic,p2439.html), [mTitle Kinetic 2](https://www.motionvfx.com/collections/mtitle-kinetic-2), [mTitle Refined](https://www.motionvfx.com/collections/mtitle-refined) and [mTitle Restyle](https://www.motionvfx.com/store,mtitle-restyle-dvr,p3823.html)) describe their presets only in marketing terms ("Apple keynote-inspired", "minimalistic", "impactful"), with the motion itself shown in demo videos. The looks below are original implementations of the motion vocabulary those families are known for. No MotionVFX assets or designs are copied.

| Family style | Looks |
| --- | --- |
| Keynote-style kinetic type | Mask reveal (rise / slide), Focus in (soft focus / zoom slam), Swipe in, Turn in, Slot roll |
| Hype / restyle | Stretch in, Split slice, Echo stack, Bouncy letters (bounce drop / elastic pop) |
| Minimal / refined | Highlight (marker swipe / block wipe), Underline reveal, Outline fill, Stroke draw |
| Utility | Flicker on, Number count, Circle text |

Each was checked against the existing text effects (typewriter, scramble, staggered rise/flip/pop/depth/scatter/spiral, wave, gradient, neon, glitch, Kinetic title entry) so that none duplicates an existing motion.

## How they work

`src/title-effects.ts` computes a per-grapheme `TitleFrame` from the clip time: transforms, blur, clip-mask travel, slot reel offset, box/line decorations, outline, echo, split and stroke-draw progress. `AnimatedText` layers these onto the same per-grapheme spans the older text effects use, so title looks combine with them and with keyframes.

- **Masks** clip a stationary box while the glyphs travel inside it. Vertical masks clip each letter. Horizontal masks sweep a reveal edge across each word, because per-letter clips would chop glyphs.
- **Highlight, underline**: per-letter boxes and lines whose sweeps join into one continuous bar. Spaces become boxes so the bar has no gaps. Stagger sets how sharp the sweep front is.
- **Outline / echo**: `-webkit-text-stroke` copies. **Stroke draw**: an SVG `<text>` overlay with an animated `stroke-dashoffset`, followed by the fill.
- **Slot roll**: a reel of seeded glyphs of the same class (digits, lowercase, uppercase), ending with a back-eased overshoot.
- **Number count** rewrites every number in the text, keeping decimals and thousands separators. **Circle text** lays the line around a rotating ring whose size follows the text length.
- Entrances use `seconds`, `stagger`, and `motion.order` (forward/reverse/random). Setting `motion.direction: "out"` plays the same motion as an exit at the clip end.

## Limits

- Slot reels and horizontal masks clip at each glyph's box, so wide reel glyphs inside narrow letters crop mid-roll.
- Stroke draw uses an estimated outline length, so very complex glyphs (CJK) may still be drawing when the fill fades in. Its SVG baseline is approximate for unusual fonts.
- Circle text expects a single line.
- Number count changes the text width while counting; tabular-figure fonts avoid jitter.
