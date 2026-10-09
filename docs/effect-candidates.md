# Effect candidates from open-source repositories

> **Implemented October 9, 2026 (bundles A, B, C):** T1, T4, T5, T6, T14, T15, T16, T19, T25, T26, T27, T28; R1, R2, R3, R4, R6, R7, R12; F1, F6, F7, F9. See the README section "Open-source-inspired effects". The rest remain candidates.

October 9, 2026. Three surveys read the actual implementations in React Bits, Motion Primitives and Magic UI (text); gl-transitions and PixiJS filters (shaders); and reactvideoeditor/remotion-templates, Remotion (transitions and effects), Motion Canvas and editly (motion). Each candidate was checked against the 73 built-in cards and KamiKami's rendering model: per-frame pure functions, SVG filters, CSS transforms, per-grapheme spans, a single element per effect, and no WebGL. Duplicates and infeasible items are listed at the end.

Effort: S ≈ hours, M ≈ a day, L ≈ multiple days.

## T: text and titles

| ID | Effect | Sources | Mechanism read | KamiKami mapping | Effort |
| --- | --- | --- | --- | --- | --- |
| T1 | Blur rise | RB BlurText; MP text-effect fade-in-blur; MU text-animate blurInUp | Per unit: blur 10→5→0px, y ±50→∓5→0 (small overshoot), 0.2 s stagger | stagger style `blur` | S |
| T2 | Hinge fold | RB FoldText | rotateX/Y ±92→0 about an edge origin; multiply crease shade 0.55→0 | `turn` with a hinge direction, plus shading | S |
| T3 | Squash-stretch float | RB ScrollFloat | yPercent 120→0, scaleY 2.3→1, scaleX 0.7→1, 0.03 s stagger | stagger style `float` | S |
| T4 | Karaoke read-along | RB ScrollReveal; MU text-reveal; Remotion TikTok template | Ghosted words (opacity 0.1, blur 4) light up in sequence across the clip; optional 3° tilt-in | new kind `karaoke` (even split; per-word timings later) | S |
| T5 | Shimmer band | MP text-shimmer; MU animated-shiny-text; RB ShinyText | Text-clipped transparent→highlight→transparent band sweeping across the glyphs | `gradient` variant `shine` | S |
| T6 | Prism reveal | MU dia-text-reveal | Gradient: solid text behind a rainbow band, transparent ahead of it, swept 0→100% | `highlight`/`mask` variant `prism` | S |
| T7 | Shimmer swell | MP text-shimmer-wave | Per-char [0, peak, 0] translateZ, scale 1.1, rotateY 10° and color, swept across | `wave` variant `swell` | S |
| T8 | Hatched line shadow | MU line-shadow-text | Offset copy (0.04 em) filled with scrolling 45° stripes, text-clipped | new kind `lineshadow` | S |
| T9 | Comic halftone | MU comic-text | Halftone-dot text fill, thick stroke, skewX −10°, double hard shadow, pop-in | new kind or preset (dot fill is new) | S |
| T10 | Sparkles | MU sparkles-text | Four-point stars twinkle (opacity/scale 0→s→0, rotate 75→150) at seeded spots | new kind `sparkle` | S–M |
| T11 | Weight wave | MU kinetic-text; RB TextPressure / VariableProximity | A heavier-weight bulge sweeps across the letters (pointer replaced by time) | `wave` variant; fake weight with text-stroke | M |
| T12 | Scanline fuzz | RB FuzzyText | Every pixel row jittered sideways at random | `glitch` variant via horizontally stretched turbulence and displacement | S |
| T13 | Horizontal shuffle | RB Shuffle | Each letter slides sideways through a strip of copies; even and odd letters go opposite ways | `slot` with left/right/alternate | S |
| T14 | Split-flap board | RB SplitFlapText | Half tiles flip (rotateX 0→−90 then 90→0) through about 8 seeded characters per letter | new kind `flap` | M |
| T15 | Cube roll | MP text-roll; MU text-3d-flip | Two faces per letter, backface hidden, rotateX 0→90 / 90→0 with translateZ; first/last/center/random order | new kind `roll` | M |
| T16 | Odometer digits | MP sliding-number | Per-place 0–9 columns, offset `(10+n−v%10)%10·h`, shortest path | `count` variant `odometer` | M |
| T17 | Viewfinder focus | RB TrueFocus | Active word sharp inside four corner marks, other words blurred; the frame glides to the next word | new kind `viewfinder` | M |
| T18 | Marquee crawl | RB CurvedLoop / TextLoop / ScrollVelocity; MP infinite-slider | Repeated text on a line, wave or arc; `textPath` startOffset = speed·t mod length | new kind `marquee` | M |
| T19 | Letter bubbles | remotion-templates bubble-pop-text | Each glyph pops in on its own gradient circle or square (spring, 5-frame stagger) | new kind `tiles` | S |
| T20 | Color-cycle pop | remotion-templates popping-text | Springy pop with a palette glow per letter (`colors[i%3]`) | `stagger` palette variant | S |
| T21 | Line converge | remotion-templates title-split | Line 1 drops from above, line 2 rises from below, glow on meeting | `stagger` with `line` as a unit | S |
| T22 | Selection dim | Motion Canvas Code token() | Selected words stay; others go to 0.2 opacity and 3 px blur | `focus` variant with a word range | S |
| T23 | Hand-drawn annotations | Remotion rough-notation; MU highlighter | Seeded jittered box/circle/strike/bracket paths drawn on with dashoffset | new kind `annotate` (extends highlight/underline) | M |
| T24 | Rounded caption box | Remotion rounded-text-box | One SVG path hugging each line, with rounded inner and outer corners | new kind `captionBox` | M |
| T25 | Word rotator | RB RotatingText; MU word-rotate; MP text-loop; Motion Canvas cursor | Cycles through a word list: the outgoing word exits up while the next rises in per char | new kind `rotate` (needs a `words[]` param) | M |
| T26 | Type and delete loop | RB TextType; MU typing-animation | Types a word, backspaces it, types the next; line/block/underscore cursors | `typewriter` with `words[]` | S–M |
| T27 | Retype | Motion Canvas textLerp (MIT) | Characters below `floor(len·v)` come from the new string; length is interpolated | new kind `retype` (`from` text) | S |
| T28 | Gooey word morph | MU morphing-text | Cross-blur two words; an alpha-threshold color matrix merges them like liquid | new kind `morph` (needs `words[]`) | M |
| T29 | Letter rearrange | MP text-morph | Shared letters glide to their new positions, the rest fade | new kind (needs measured layouts) | L |
| T30 | Text as window onto media | RB MaskedHeading; MU video-text | The text acts as a clip-path over an image or video | needs a media reference in the recipe (or mattes) | L |
| T31 | Blueprint lens | RB TechText | A sine-path lens reveals dashed-outline glyphs with dimension labels | SVG mask plus a moving radial gradient | L |

Small additions: a `center` stagger order and `line` as an animation unit.

## R: reveals and transitions (single clip)

| ID | Effect | Sources | Mechanism read | Approach | Effort |
| --- | --- | --- | --- | --- | --- |
| R1 | Shape iris (star, heart, flower, rectangle, diamond, wobbly burn) with rim glow | gl StarWipe, heart, polar_function, Box, undulatingBurnOut; remotion-templates spotlight-reveal | Point-in-shape test; polar `r(θ)=(cos(nθ)+4)/4·p`; rim band | feImage shape mask scaled by progress, plus a rim from a larger shape minus the shape | S |
| R2 | Barn door / bow-tie | gl Horizontal/VerticalOpen/Close, BowTie*; remotion-templates logo-split-reveal | `abs(uv.y−0.5)` vs. progress; triangle doors | Rect or triangle mask, blurred for softness | S |
| R3 | Clock wipe / pinwheel | gl angular, Radial, pinwheel; Remotion clock-wipe | `atan` angle vs. progress; `mod(θ+p, π/4)` blades | Pie-wedge path masks | S |
| R4 | Angled, feathered, 8-way wipe | gl directionalwipe; Remotion wipe; editly slide-in-text; Remotion evolve | Direction projection plus smoothstep feather (20%) | Extend the existing wipe with angle and softness | S |
| R5 | Ragged / static-edge wipe | gl wind, static_wipe | Per-row random edge offset; noise band riding the edge | Seeded row rects; turbulence strip | S |
| R6 | Luma wipe and gradient-map wipe | gl dissolve (luma burn), luma, luminance_melt | Threshold `0.5+0.5·luma − p`, hot edge band | Luminance → steep alpha transfer, plus a colored edge | S |
| R7 | Cell reveals (growing squares, random tiles, checkerboard, polka-dot curtain) | gl squareswire, randomsquares, BlockDissolve, chessboard, PolkaDotsCurtain | Per-cell size or visibility as a function of cell index and progress | feImage of seeded rects or circles as a mask | M |
| R8 | Tile flip grid | gl GridFlip, TilesWave, PuzzleRight | Per-tile flip with a random delay | Clip-path tile clones with CSS rotateY | M |
| R9 | Column drop ("melt") | gl DoomScreenTransition | Per-bar speed from wave, random and drip terms | Y displacement by a bar map, plus a vacated-region mask | M |
| R10 | Split slide | gl splitSlide* | Halves push out in opposite directions | Two clip clones translating apart | S |
| R11 | Paper tear | Remotion effects/tear | Zigzag split; halves rotate about a pivot and fall away | Seeded zigzag clip clones | M |
| R12 | 3D card moves (cube turn, doors, page turn, corner roll, swap with reflection) | gl cube, doorway, BookFlip, Rolls, swap; Remotion book-flip, swap | Rotation about edges and hinges with perspective | CSS rotate with edge origin; half-clones for doors and book; flipped reflection clone | S–M |
| R13 | Push-cut | Remotion push-cut | Out 1→1.04, in 1.04→1.07, 2-frame 0.2 flash | Scale channel recipe plus flash pass | S |
| R14 | Channel-stagger fade | gl colorphase | Red, green and blue fade on offset windows | Per-channel component transfer | S |
| R15 | Edge trace in/out | gl EdgeTransition | Sobel edges × brightness, then fade | Sobel convolve plus arithmetic (luminance edges, not alpha) | S |

## F: looks and filters

| ID | Effect | Sources | Mechanism read | Approach | Effort |
| --- | --- | --- | --- | --- | --- |
| F1 | Ripple / shockwave / water drop | gl ripple, WaterDrop; Pixi shockwave | Radial offset × ring wave; single ring `1−diff²` with brightness | Gradient vector map × repeating radial ring → displacement | M |
| F2 | Compound eye / glass blocks | gl flyeye | `size·(cos(zoom·x), sin(zoom·y))` sampled per channel | Repeating gradients, displacing each RGB channel separately | S |
| F3 | Swirl / twist / pinch | gl Swirl; Pixi twist | Angle `((R−d)/R)²·A` | Sampled vector-field helper (grid of rects → blurred → displacement) | M |
| F4 | Film burn / drifting light leak | gl FilmBurn; Remotion light-leak; remotion-templates film-burn | Seeded drifting warm blobs with an intensity bell | Blurred radial blobs on smooth seeded paths, screen-blended | S–M |
| F5 | God rays | Pixi godray | 1D turbulence along the angle to the light, with falloff | Seeded wedges or stretched turbulence, blurred and masked | S–M |
| F6 | Water reflection | Pixi reflection | Mirrored copy with cosine ripples and alpha falloff | Flipped clone, gradient mask, stripe displacement | S |
| F7 | Tilt-shift | Pixi tilt-shift (glfx.js) | Blur radius grows with distance from a sharp band | 2–3 blur levels through gradient band masks | S |
| F8 | ASCII art | Pixi ascii | Pixelate cells, pick a glyph per brightness band | Pixel pass + band transfer + tiled original glyph patterns | M–L |
| F9 | Old film | Pixi old-film | Sepia, seeded scratches and dust, flicker | Stepped seeded lines and specks with grade, grain and vignette | S |
| F10 | Selective color / color replace | Pixi color-replace | RGB distance threshold | Per-channel band-pass mask over a desaturated copy | M |
| F11 | Drop shadow | Pixi drop-shadow | Offset and blur of alpha | feDropShadow with an envelope | S |
| F12 | Blurred-fill backdrop | editly contain-blur | A blurred, cover-scaled copy fills the letterbox | Back clone scaled to cover and blurred | M |
| F13 | Polaroid drop | remotion-templates polaroid-frame | White print border, spring drop and tilt | Frame pass plus a spring channel recipe | S |
| F14 | TV color bars | Remotion tv-signal-off | Mix into SMPTE bars | Broken TV variation with a bars overlay | S |
| F15 | More easing curves | Motion Canvas timingFunctions (MIT); editly easings | expo, circ, quart/quint, ease-in variants | Channel curves | S |

## N: features that need new element types or engine work (not effects)

- Shape layers and path drawing/morphing (Motion Canvas Curve; Remotion shapes and paths).
- Generator backgrounds: solid, linear/radial gradient, rainbow, gradient shift, grid pulse, starfield, matrix rain, rays (editly; remotion-templates).
- Masks and track mattes. These also unlock T30.
- Lower thirds and news banners (editly news-title; remotion-templates lower-third).
- A captions track with word timings (Remotion TikTok template), which pairs with T4/T24.
- Two-clip transitions such as crosswarp, morph, ripple-between and comparison slider. These need a transition model with access to both clips.
- Data visualization, countdown rings, credits roll, code and LaTeX elements, and carousel/photo-stack layouts.

## Duplicates (not proposed)

Pixelate, dissolve, shatter, circle iris, plain wipe, slides/zooms/rotations, blur smears, kaleidoscope, wave distortion, TV/scanline/RGB glitches, fades, bloom/glow, bevel/emboss, bulge (lens), halftone dots, outline, spotlight and color adjustments are already covered by existing cards. Text duplicates (SplitText, text-effect presets, DecryptedText/hyper-text, GlitchText, gradient texts, StrokeText, EchoText, DepthText, CountUp/number-ticker, circular/spinning text, terminal) are covered by the stagger, scramble, glitch, gradient, draw, echo, extrusion, count, circle and typewriter kinds.

## Not feasible in the current model

Two-clip shaders (morph, displacement, crosswarp and similar), anything needing previous frames or the backdrop (backdrop blur, true temporal blur), physics (FallingText), pointer- or scroll-driven interactivity, WebGL/three.js (WarpText, ASCIIText 3D, Remotion shader effects), and canvas pixel sampling (ParticleText).

## Licenses

- **React Bits**: MIT + Commons Clause, which forbids redistributing the components "as a ported version". Reimplement from the observed motion only.
- **Remotion**: source-available. It forbids copying code into a competing derivative such as a video editor. Use concepts and parameter values only.
- **Motion Primitives, Magic UI, Motion Canvas, editly, PixiJS filters, gl-transitions** (files are MIT except InvertedPageCurl and StereoViewer, which are BSD and not proposed here): copying is allowed with notices. The plan is still to reimplement, since none of that code fits the per-frame model.
- **remotion-templates**: README says MIT, but there is no LICENSE file. Reimplement.
- If formulas or constants are lifted verbatim from MIT sources (for example gl Doom drip, shockwave profile, FilmBurn tint, Motion Canvas textLerp/easings), add a NOTICES entry. Design original ASCII glyph bitmaps rather than reusing Pixi's, whose provenance is unclear.
