# Spring, illustration, 3D-look, light and organic effects

Added October 9, 2026: 14 cards and 37 named looks. The gallery now has 57 cards.

## Selection

The candidate list came from After Effects built-ins and popular plugins (Turbulent Displace, Bevel Alpha, CC Light Sweep, CC Cylinder/Sphere, Card Wipe, Gradient Wipe, Saber, Deep Glow, Trapcode Shine), motion-design packs (Animation Composer and Motion Bro bounce/elastic presets), CapCut/TikTok trends and 2026 motion trends: collage/paper cutout, hand-drawn "boil", pixel/dither, holographic foil, liquid glass, metaball goo. Each candidate was checked against the existing 24 pass kinds and 43 cards. Effects that duplicated existing treatments were dropped: ordinary glow vs. Neon text/bloom, wave displacement vs. signal distortion, halftone vs. Print screen, and riso, which overlapped duotone plus halftone.

Constraints: recipes stay declarative. Every frame is a pure function of time and seed, so preview and export match. Rendering is SVG filters plus CSS transforms, with no WebGL, optical flow or previous-frame access. Each element is rendered on its own, so "refraction" and "glow" only see that element.

## New cards

| Card | Category | Looks (variations) | How it works |
| --- | --- | --- | --- |
| **Spring motion** | Camera & motion | Elastic pop, Bounce drop, Jelly wobble, Overshoot slide, 3D flip in, Pendulum swing, Anticipation exit | New curves `back`, `anticipate`, `elastic`, `bounce`, `damped`. New channels `scaleX`, `scaleY`, `skewX`, `rotateX`. Channel `seconds`/`align` runs a curve as a short entrance or exit instead of across the whole clip. |
| **Line boil** | Illustration | Subtle boil, Sketchy | `warp` (boil): turbulence → displacement with the seed stepped at speed × 12 fps, like redrawn frames on twos. |
| **Liquid warp** | Texture & signal | Liquid flow, Heat haze, Melt away | `warp` (liquid/melt): two noise seeds crossfaded for smooth evolution. Melt displaces sampling upward only, so paint drips down. |
| **Paper cutout** | Illustration | Paper sticker, Stop-motion cutout | `paper`: dilated alpha, torn by noise, filled with paper color and fiber texture, with a soft drop shadow. Stop-motion re-tears the edge 6 × per second and adds shake channels. |
| **Comic ink** | Illustration | Cel shade, Bold marker | `ink`: posterized color, a Laplacian edge pass on luminance, and an alpha contour, inked and thickened. |
| **Pixel art** | Illustration | Pixelate, Pixel-in transition, 1-bit dither, Four-tone handheld | `pixel`: sample-and-dilate pixelation, an ordered 4×4 Bayer threshold, and a discrete palette map. |
| **Bevel & emboss** | 3D & material | Soft bevel, Orbiting light | `bevel`: blurred alpha bump lit with normalized diffuse light plus a specular highlight; the light azimuth can orbit. |
| **Solid extrusion** | 3D & material | Isometric block, Long shadow | `extrude`: union of shifted alphas in doubling steps (log₂ depth primitives), shaded near → far. |
| **Holo card** | 3D & material | Foil tilt | rotateX/rotateY sine tilt with a `sheen` foil pass. |
| **Lens bulge** | 3D & material | Magnifier sweep, Parked lens | `lens`: linear ramps inside a circle drive `feDisplacementMap` for uniform magnification, with a glass rim. |
| **Light sweep** | Light & color | Gloss sweep, Holographic foil | `sheen`: a moving gradient band (or rainbow foil) screened and clipped to alpha. |
| **Energy edge** | Light & color | Electric blue, Saber red, Toxic green | `glow`: outline ring, turbulence-displaced and stepped, with a hot core and three halos plus seeded flicker. |
| **Noise dissolve** | Transitions | Dissolve in, Burn away | `dissolve`: thresholded fractal noise, with a glowing band at the dissolve front. |
| **Gooey morph** | Transitions | Goo in, Goo out, Breathing goo | `goo`: blur followed by an alpha contrast threshold (metaball). |

All of these export as `kamikami-visual-v6` bundles. Every numeric setting, including Extrusion depth, Pixel size, Lens radius and Light direction, can be keyframed on an applied instance (see [keyframes](keyframes.md)).

## Costs and limits

- About 10 primitives or more per frame: Paper cutout, Energy edge, Comic ink and the dither modes of Pixel art. They are fine for titles and stills; expect slower previews on full-frame video.
- Warp displacement samples outside the element, so full-frame plates get an organic transparent edge. Scale the plate slightly (or add Camera zoom) to hide it.
- Lens bulge and Energy edge only see the element they are applied to, not layers beneath it.
- Comic ink detail lines depend on image contrast. Flat vector art mostly receives the outer contour.
- The Line boil, Paper cutout stop-motion and Energy edge flicker rates are tied to speed, not to the project frame rate (24 fps).
