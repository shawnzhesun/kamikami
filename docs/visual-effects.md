# Visual effects

These sections work on any visual element unless noted. Rendering is SVG filters plus CSS transforms: no WebGL, no optical flow, no access to previous frames. Each element renders on its own, so glow, lens and refraction only see that element.

## Channels and curves

A channel animates one property from `from` to `to` over the clip, or over `seconds` at its start (or its end with `align: "end"`). Fields: `property`, `curve`, `from`, `to`, `frequency` (cycles per second), `phase` (cycles), `seconds?`, `align?`.

- **Additive properties:** x, y, rotation, blur, letterSpacing, rotateX, rotateY, skewX.
- **Multiplicative properties:** scale, scaleX, scaleY, opacity, brightness, contrast, saturation.

| Curve | `frequency` / `phase` mean |
| --- | --- |
| linear, ease, ease-out, sine, pulse | Cycles per second / phase in cycles |
| shake | Held samples per second |
| steps | Number of steps |
| back, anticipate | Phase = extra overshoot |
| elastic | Oscillations |
| bounce | Bounces |
| damped | Hz; phase = extra damping |

## Passes

Passes are SVG graphics: light and color, texture and signal, illustration and material, graphics, and reveals and transitions. The kind list is `visualKinds` in `src/visual-effects.ts`; the pass count limit is in the schema. Shared fields are `strength`, `size`, `speed`, `color`, `secondary`, `angle`, `timing` (constant, in, out, pulse), `seconds` and `seed`, plus mode fields per kind. For reveals, strength 1 means fully hidden, so timing `in` reveals the element.

## Depth, particles and fields

These are implemented in `src/motion.ts`.

- **`depth`** moves a flat element through perspective:
  - `mode` travel or float; `from`/`to` distance (positive recedes); x/y offsets; tilt and rotation that settle by the end.
  - `perspective`, `focus` and `blur` give depth of field. Near-plane fading avoids infinite scale.
- **`passes[].particles`** emits dots, paper or sparks:
  - Modes: drift, burst, tunnel, vortex. Emitters: point, box or sphere.
  - Settings: lifetime, gravity, drag, turbulence, spin, trails and focus.
  - Trajectories are analytic, so seeking doesn't depend on playback.
  - `clipToSource` keeps particles inside the element's alpha.
- **`passes[].field`** arranges repeated copies in a volume, tunnel or orbit, or repeats words or letters of a text.
- **Limits:** copy and particle counts are capped by the schema. These are flat cards in depth, not extruded geometry. There's no camera shared across elements.

## Artwork treatments

`effect.art` is implemented in `src/artwork.ts` and rendered by `src/ArtworkLayer.tsx`. Its fields are `strength`, `tempo`, `speed`, `distance` (a fraction of the frame's short side), `count`, `angle`, `seconds`, `timing` (constant, beat, in, out), `direction` and `seed`.

The kinds are `artKinds` in `src/artwork.ts`: camera kinds (`artCameraKinds`: sway, beat hits, strobe, stop-motion stutter) work on any visual element, text included; the copy kinds `trail` and `slices` work on pictures only.

- **Beats** count from the project start, so elements on one tempo hit together.
- **Video copies:** copies of video are muted, and slices decode the video once per band, so keep the band count low.

## Riso print

The `riso` pass (kamikami-visual-v9, `src/PrintGraphicEffects.tsx`) prints any element as a risograph: one plate per spot ink in `risoInks` (one to three).

- **Plates:** a plate's coverage is how much of the light its ink absorbs is missing from the element, measured against the paper (`color`), so paper-colored areas take no ink. There is no black: darks come from overprinting plates, which multiply.
- **Screens:** each plate is screened into dots whose area matches the tone, at its own angle (15°, 75°, 0°, turned by `angle`), with the pitch set by `size`. One plate never prints a true solid.
- **Press faults:** `registration` sets how far the plates miss each other; `speed` above 0 moves them a few times a second. `inkGrain` starves the ink unevenly.
- **Paper:** `risoPaper: "clear"` prints the inks alone, so text keeps no paper behind it.
- **Timing:** unlike other passes, timing changes the ink rather than the strength: at clip start the dots grow from bare paper, at clip end they print away.

## Costs and limits

- Heavy passes run about 10 or more SVG primitives per frame: paper, glow, ink, pixel dither and riso (about eight per ink). They're fine on titles but slower on full-frame video.
- Warp samples outside the element, giving full-frame art a ragged edge. Scale it up slightly to hide it.
- Line boil and flicker rates follow `speed`, not the project frame rate.
