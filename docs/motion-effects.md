# Motion effects

The motion study adds two library cards and expands three existing families. No reference-video media is bundled.

| Library card | Named starting points |
| --- | --- |
| **Text Glitch** (new) | Signal stutter, Sliced title, RGB rupture, Corrupted reveal |
| **Depth Motion** (new) | Approach and settle, Recede, Fly past camera, Floating card |
| **Particles** | Existing Drifting paper and Radial bursts; Floating dust, Confetti drift, Depth fireworks, Star tunnel, Vortex |
| **Image Repetition** | Existing Grid, Mirror, Kaleidoscope and Nested frames; Floating objects, Depth tunnel, Orbital field, Glyph field |
| **Staggered Text** | Existing Rise, Flip and Pop; Depth fly in, Depth fly out, Scatter assembly, Spiral assembly |

## Using the effects

Drag an effect onto an element, then click its applied instance to choose a preset and adjust the parameters. Presets replace the current recipe with a starting point; subsequent edits remain independent. Double-clicking a library effect opens its read-only General view with Fork. My effects supports editing names and defaults, Fork, Delete and Save. Saving defaults never changes existing applied instances. Preview text is **Title**.

- **Text Glitch:** select characters, words or the whole title; adjust the affected fraction, burst duration, frequency (Speed), jitter, slice displacement, RGB separation and dropout. Optional replacement characters accept Unicode graphemes, including Japanese and emoji. Entrance mode always settles after Duration; exit mode runs during the final Duration seconds. Speed zero stops glitches. Text layout and the original string remain intact.
- **Depth Motion:** positive distance recedes and negative distance approaches. Start/end distance determine the path; horizontal/vertical offsets and initial tilt/rotation settle to zero at its end. Float moves back and forth along the same path. Distance and offsets are normalized scene units, angles are degrees, and duration is seconds. Perspective distance also affects the apparent depth scale. Focus distance selects the sharp plane; Focus falloff controls blur away from it. Near-plane fading avoids infinite scale.
- **Particles:** enable Particles in depth or choose a depth preset. Select Drift, Burst, Tunnel or Vortex, with point, box or spherical-surface emission and dot, paper or spark shapes. Count is independent of particle size. Lifetime, gravity, drag, turbulence, spin, size at end of life, focus, trails and seed are adjustable. Bursts repeat together at Lifetime intervals; other modes stagger particle ages. Speed scales simulation time, so lifetime is measured in simulation seconds. Particles can leave the source alpha by default; Clip particles to source alpha is a separate option. Output remains bounded by the composition.
- **Image Repetition:** enable Arrange copies in depth to distribute copies in a volume, tunnel or orbit. Adjust count, spacing, depth, object size, rotation, speed, seed, face-camera orientation and focus. Whole-element repetition samples the existing picture once, including a video frame, without mounting additional video/audio players. Text can instead distribute words or graphemes. Non-text sources always repeat the whole picture.
- **Staggered Text:** select a motion style, entrance/exit direction, forward/reverse/random timing, stagger and easing. Depth/scatter/spiral add depth distance, scatter radius and rotation spread. Word timing applies the same motion to each grapheme in the word; it does not make an extruded word mesh.

## Renderer and persistence

`src/motion.ts` holds the shared schemas, seeded randomness, projection and frame evaluation. Motion depends only on recipe, local time plus retained effect offset, and seed. Split clips preserve the original effect duration and time offset. Particles use analytic trajectories and spatial waves rather than stateful integration, so seeking does not depend on playback history.

Depth Motion joins the existing element transform in `layerAtTime`. `AnimatedText` applies glitch and per-glyph motion while preserving font, gradient and neon styling. `SpatialGraphicEffects` renders depth-sorted repeated artwork with SVG inverse sampling, and particles with SVG sprites. The composition, exports and library samples use the same evaluators. Canvas selection and hit tests follow the element's perspective plane; generated copies and particles remain part of their owner, not separately selectable objects.

New settings are stored in optional `Effect.depth`, `TextEffect.glitch` / `TextEffect.motion`, and `VisualPass.field` / `VisualPass.particles` fields. Existing recipes retain their old defaults. Project JSON stays at version 2 with full independent instance snapshots. New recipes require `kamikami-visual-v5`; older bundles remain supported. A service capability check blocks saving/rendering new settings through an outdated service, including when those settings exist only on an instance. Restart the development app/service after updating.

## Limits

- These are flat sprites/cards and glyphs projected in depth, not extruded geometry. Repeated artwork uses affine tilt/foreshortening; individual element and glyph tilt uses CSS perspective.
- Objects sort within their field. Separate timeline elements retain timeline order, with no global camera, shared depth buffer, lighting or cross-element occlusion.
- Text animation and glyph segmentation run before the graphics filter stack. The first word/glyph field segments the title; additional field passes repeat that rendered result as a whole. Graphic effects apply to the assembled field, not independently at arbitrary positions between glyph operations.
- Limits are 48 repeated objects and 256 particles per pass. Dense translucent copies, focus blur and trails can be expensive. Start with the supplied counts; real-time frame rate is not guaranteed.
- Trails are short analytic line segments. Source-alpha emission, physical collisions, fluid simulation and temporal shutter-sampled motion blur are not implemented.

## Verification

`npm test` covers schema bounds, preset round trips, legacy compatibility, independent instances, split continuity, seeded seeking, near clipping, projection hit tests, depth ordering, Unicode, text paint combinations, single-source video repetition and stale-service protection. `npm run build` checks TypeScript and production bundling.

`npm run test:text-render` additionally rasterizes text combinations and motion previews in Chromium, checks visible text and spatial-preset changes, checks repeatable seeking, and writes screenshots for theme review. This check could not complete in the implementation sandbox because Chromium failed to launch. Browser appearance and export raster parity still need a run in the normal desktop environment; shared renderer code alone does not establish visual parity.
