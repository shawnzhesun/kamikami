# Kinetic type

Kinetic type kinds (`kamikami-visual-v8`) animate title elements with the timing language of lyric videos. Every frame is a pure function of clip-local time, so previews, scrubbing and export match.

## Roles

| Role | Timing | Kinds |
|---|---|---|
| Entrance | Over the first `seconds` of the clip; **Play as: Exit** runs it backwards over the last `seconds` | spring, hop, wheel, hinge, spin, slam, fan, drum, shuffle, cardflip, ripple, lens, glint, brush, ink, decode, rain, push, flash, inertia, gather, plates, inkstroke |
| Exit | Always over the last `seconds` of the clip | kick, launch, flutter, domino, closegap, burn, tornado, blast, crumble, wipeoff, aperture, channels, melt |
| Hold | Loops on `tempo` (BPM, default 120) between the element's entrances and exits | pluck, beathop, colorrun, dangle, rock, ride, breathe, pulse, lean, afterimage, gust, lubdub |

A hold eases in once the longest entrance on the same element has nearly finished and eases out before the earliest exit starts. That makes "entrance + hold + exit" on one element the basic lyric-line recipe.

### Shards, plates and channels

- **gather / blast / crumble** cut each glyph into six seeded triangles (`clip-path` polygons fanned around a point inside the glyph). Shards are copies of the glyph that move and spin about their own centroid; gather flies them in from a scatter, blast throws them out with gravity after a flash, crumble shudders the letter and drops the shards one by one.
- **plates** draws cyan, magenta and yellow copies screen-blended and offset in three directions; they slide into register and the ink takes over at 80%.
- **channels** splits the type into red, green and blue screen-blended copies that drift apart and fade.
- Kinds whose copies replace the glyphs hide the glyphs with a clip, not opacity, so a word's copies stay visible.
- **inkstroke** paints a wet bristle band (one bar per strip, ragged ends) along each line; the type shows once the band has passed. **wipeoff** sweeps an accent bar that cuts the text away; **aperture** closes a circular clip with a ring mark; **melt** stretches letters down from the top while they drain, with drips.
- **afterimage** drifts the text on a slow figure eight and leaves four screen-blended echoes at earlier positions; **gust** bends letters along the line every four beats; **lubdub** pulses a strong beat and a softer echo every two beats and flushes the accent color.

## Units

- **Character**: each letter moves on its own.
- **Word**: each word is wrapped and moved as one rigid piece, so hinges and spins pivot the word, not each letter.
- **Whole title**: the full text block moves as one.

`motion.order` sets the stagger: forward, reverse, random, **center** (out from the block center) or **edges** (in towards the center).

## Geometry

Kinds that travel between letter slots (shuffle, push, flash, fan, ripple, lens, glint, brush, closegap, tornado) use letter and word boxes. In the editor and in exports they come from canvas measurements of the loaded font, including letter spacing. Without a browser, a fixed estimate keeps the same motion. The text is laid out left-aligned with explicit line breaks, as title elements already are.

## Building blocks

- Damped springs that land exactly at rest, back/elastic/bounce/expo easing, and squash and stretch from velocity.
- Masks and clip paths in each letter's own box (glint band, brush bristles, ink blot, burn front).
- Copies of a unit for trails and ghosts (matrix rain, glint).
- Marks drawn in the unit's box (card tiles, decode cursor, ink drop, embers).
- Character substitution with seeded signs (decode, rain).

## Fonts

The bundled lyric faces are Latin-only subsets of the Google Fonts releases, except IBM Plex, which ships unchanged (Reserved Font Name "Plex"). See `public/fonts/LICENSES.txt`.

## Credits

Techniques were studied from JIZURA (https://github.com/852wa/JIZURA, MIT) and reimplemented for KamiKami's DOM renderer; no JIZURA code is included.

## Kinetic layouts

`src/text-layouts.ts` (text kinds, unit word, v8). A layout computes a target placement for every word — position, scale, rotation in em from the block center — plus a per-word entrance, and returns them as word-level kinetic frames (offsets from the word's place in the normal line). `amount` interpolates from the line to the arrangement, so strength 0 leaves the line untouched. Layout frames are merged before kinetic motions, so a motion still plays on top of the arranged word.

| Kind | Arrangement | Settings |
| --- | --- | --- |
| slamstack | one word per row, scaled to the widest row (short words capped at 3×, tall stacks shrink to fit), slamming in | seconds, stagger, motion.order |
| keyword | the longest word large; words before/after small, above/below, flush left | seconds, stagger |
| steps | left-aligned rows, each smaller | distance = how fast sizes fall |
| giant | the longest word up to 8× and cropped to the text block, behind the rest (z-index −1 in an isolated run); the line closes the gap | secondary = giant color |
| swap | one word per beat alone in the center, then all words fly into the line | tempo, seconds = assemble |
| typeslam | the line at a small size while words appear, then a slam to full size | seconds, distance = typed size |
| flowsnap | words float loose, tilted and scaled, then snap into place | seconds, stagger, distance = scatter |
| seesaw | hold: the whole line tilts alternately on each beat with a spring | tempo, angle |
| arc | words placed by arc length on a circle, turned along it, riding in | seconds, distance = bend |
| bandhide | a solid band sweeps across; words appear once it passes | seconds, color |

Geometry now centers each line in the block, matching the centered rendering.
