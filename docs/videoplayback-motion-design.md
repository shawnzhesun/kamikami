# Motion effects case study: videoplayback.mp4

Original design study. The first implementation is now available; see [motion effects](motion-effects.md) for shipped controls, architecture, compatibility, and limits. It uses the existing SVG/CSS renderer with a shared projection evaluator rather than adding Three.js.

## Review scope

Source: `/Users/shawn.sun/Downloads/videoplayback.mp4`, 1920 × 1080, 188.8887 seconds, 30000/1001 fps, verified with ffprobe.

Reviewed 95 overview samples at approximately two-second intervals, plus seven sequences of 24 samples each: 00:28–00:34, 00:35–00:39, 01:04–01:10, 02:04–02:10, 02:24–02:30, 02:38–02:46 and 02:52–02:58. Dense sequences were sampled at 3–6 fps. This is a targeted motion study, not inspection of every source frame or recovery of the original project.

Contact sheets are in `/private/tmp/kamikami-motion-study/`. They are review materials, not bundled app assets. The original video cannot establish whether a shot used genuine 3D geometry, flat planes in a 3D scene, or carefully coordinated 2D transforms.

## Observations and proposed coverage

| Approximate time | Visible treatment | Proposed coverage |
| --- | --- | --- |
| 00:29–00:31 | Separated and tilted text appears small, then assembles into a title | Staggered Text depth entrance and scatter assembly |
| 00:31–00:34 | Text enlarges and softens while character framing changes | Depth Motion with a focus range; separate animation for independently moving artwork |
| 00:35–00:36 | Background glyph patterns switch, repeat densely and distort | Text Glitch combined with Image Repetition in glyph/word mode |
| 01:05 and 01:07.5–01:08.5 | Overlapping graphic panels, abrupt approach, blur and a change of view | Depth Motion; Image Repetition only where the repeated artwork is actually identical |
| 02:07–02:09 | Signs arranged at different apparent distances with changing framing | Object-field repetition or separately authored elements with depth motion |
| 02:24.5–02:29 | Expanding fireworks and drifting typography; foreground characters enter over the background | Particles with depth, bursts and trails; independent foreground motion |
| 02:40–02:45.7 | Repeated clocks differ in size, tilt, overlap and sharpness; framing approaches a clock | Image Repetition volume mode plus Depth Motion and focus controls |
| 02:52–02:55.5 | Small glyphs gather, text enlarges, then a dense glyph field fills the picture | Staggered Text depth assembly, Text Glitch and glyph-field repetition |

The changing drawings, independent clock-hand positions and lyric words are authored content. A general effect should animate supplied artwork and text, not embed the reference video's assets.

## Proposed library changes

### Text Glitch — new card, reuse existing text and graphics operations

Current Text Scramble is a reveal that replaces unresolved characters. Broken TV Signal and Chromatic Fringe operate on rendered graphics. Add independently timed character/word corruption, without cloning those existing render operations.

Controls: affected units (characters/words/whole title), amount affected, burst frequency, burst length, positional jitter, slice displacement, RGB offset, temporary dropout, replacement alphabet and seed. Keep glyph substitution optional: a positional glitch should preserve the original wording. Preserve grapheme boundaries and layout; support Japanese/custom glyph sets and the user's font.

Presets: Signal stutter, Sliced title, RGB rupture and Corrupted reveal. Presets load parameters, and users can continue editing. Existing Text Scramble recipes and IDs remain valid; it may later become a reveal preset of this family if compatibility and discoverability are preserved.

Use shared burst timing for the component operations. Independent, unsynchronized random values for every parameter would make a short deliberate glitch difficult to art-direct. Add an explicit settled state after an entrance so text cannot remain accidentally invisible.

Adobe's text animators provide a useful reference for per-character properties and selectors [1]. This is inspiration for the control model, not evidence of the original video's production method.

### Depth Motion — new card

Animate actual depth along with lateral position and orientation. Offer object motion against a fixed camera first; camera movement around a field of objects can use the same projection module. A single flat element cannot supply internal scene parallax or hidden geometry.

Controls: near/far start and end, horizontal/vertical path offset, tilt, rotation, easing, duration, perspective strength, focal plane and focus falloff. Keep plain 2D Camera Zoom unchanged. On one front-facing isolated plane, a depth move may resemble scale; the difference becomes useful with tilted surfaces, repeated objects, focus and occlusion.

Presets: Approach and settle, Recede, Fly past camera and Floating card. Do not create separate Zoom In/Zoom Out variants of the existing scale effect. Prevent singular projections at the camera plane with near clipping and a controlled exit.

Camera position, point of interest and depth of field are established controls for synthetic scenes [2]. Three.js provides the perspective camera implementation to evaluate [3].

### Particles — extend the existing card

Retain Paper and Radial bursts, adding a depth volume and motion choices: Drift, Burst, Tunnel and Vortex. Use the same emitter/particle model for these presets.

Controls: emitter shape, particle count or emission rate, lifetime, depth spread, velocity, gravity/drag, turbulence strength and scale, sprite/shape, size-over-life, opacity-over-life, spin, colors, trail length and seed. Separate particle size from density; the current paper implementation ties count to its size parameter.

Presets: Floating dust, Confetti drift, Fireworks depth and Star tunnel. Add source-alpha emission later for text dissolving into particles. Allow particles to leave the source bounds instead of clipping every result to the original text/image alpha. Make emission shape and output clipping separate choices.

Maxon's documented turbulence field uses spatial noise so nearby particles have related motion [4]. I recommend a similarly coherent field, with directly time-sampled motion for the first implementation rather than a stateful fluid solver.

### Image Repetition — extend with object and glyph fields

Retain Grid, Mirror, Kaleidoscope and Nested frames. Add Volume, Depth tunnel and Orbital field distributions using copies of a source texture. Text sources can repeat the whole title, words or graphemes; this gives the dense typography shots a reusable treatment.

Controls: distribution, count, spacing, depth range, rotation spread, drift, seed, face-camera toggle, focus range and source-unit choice. Clocks and signs are supplied images; multiple different drawings require multiple sources or separately authored elements.

Use shared geometry/materials and per-copy transforms where possible. Three.js documents InstancedMesh specifically for this case and its reduction in draw calls [5]. Transparency, blur and large projected cards still need performance testing.

### Staggered Text — extend its motion, not another title card

Add depth fly-in/out, scattered assembly and spiral assembly alongside Rise/Flip/Pop. Controls: depth distance, lateral spread, per-character rotation, sequence order, stagger, duration, easing and seed. Reuse the depth evaluator from Depth Motion. Presets should animate the example text **Title**.

Adobe's per-character 3D examples show the relevant position/rotation control model [1, 6]. Extruded font geometry is not necessary for a first version based on flat glyphs in space.

## Architecture and editor behavior

1. Keep text layout and glyph selection in the existing text renderer. Reuse graphics passes for color separation and distortion, with deliberate effect ordering.
2. Add a shared depth evaluation module for projection, clipping, sorting, focus and motion paths. Each applied instance retains its own recipe. A reusable module does not mean shared mutable settings.
3. Evaluate `@remotion/three` and ThreeCanvas for particles and repeated objects. Remotion documents frame-hook integration and texture support [7]. Pin compatible versions to the project's Remotion installation; verify export rendering before adopting the renderer. Its documentation specifically calls for the ANGLE renderer in server-rendering options, so preview alone is not sufficient validation. Avoid a prerequisite migration to WebGPU.
4. Derive animation from clip-local time plus retained effect offset, seed and item index. Remotion explicitly documents frame-driven animation and seeded randomness [7, 8]. For force integration added later, use fixed-step evaluation from a known state/cache; do not depend on playback history or wall-clock deltas.
5. Begin with flat sprites/planes in depth. Use one decoded texture per source where feasible, not a new video player per repeated copy. Render transformed text from a texture/atlas path that preserves fonts, Unicode and the existing gradient/neon behavior.
6. Keep generated fields self-contained on their owning element. A coordinated camera across separate elements should require a future explicit composition/group feature; changing one effect must not silently move other elements.
7. Preserve the current modal contract: library General + Fork; My effects name/default editing + Fork/Delete; applied instance parameter editing only. Named presets replace settings without a Custom entry. New fields need schema, persistence and engine-version coverage.

Optional motion blur should be evaluated after geometry is reliable. The current Motion Smear reuses the current picture at transformed positions; it is not temporal motion blur. True shutter sampling should evaluate the motion at subframe times, with explicit quality limits.

## Suggested implementation order

1. **Text Glitch and depth text entrances:** quickest useful expansion of the existing glyph pipeline. Check Japanese text and combined gradient/neon recipes immediately.
2. **Depth Motion and repeated object fields:** use the 02:40 clock composition as the acceptance example. Start with unlit artwork, depth sorting and focus.
3. **Depth particles:** add emitter lifetimes, coherent turbulence and trails after the shared projection path is stable.

Acceptance checks: deterministic forward/reverse seeking; split/trim continuity; independent settings after fork and save/reload; previews matching exported frames; readable light/dark previews; sensible near-plane exits; source-bounds escape; transparent overlap; custom font layout; and measured rendering cost with increasing object counts. No performance guarantees are established by this study.

## Primary research references

- [1] Adobe — Animating text: https://helpx.adobe.com/after-effects/desktop/animating-text/text-animation/animating-text.html
- [2] Adobe — Cameras, lights, and points of interest: https://helpx.adobe.com/after-effects/desktop/work-with-layers/camera-layer/cameras-lights-points-interest.html
- [3] Three.js — PerspectiveCamera: https://threejs.org/docs/pages/PerspectiveCamera.html
- [4] Maxon — Particular turbulence field: https://help.maxon.net/rg/en-us/Content/html/38-Trapcode-Particular-displace-turbulence-field.html
- [5] Three.js — InstancedMesh: https://threejs.org/docs/pages/InstancedMesh.html
- [6] Adobe — 3D layers and per-character 3D: https://helpx.adobe.com/after-effects/desktop/work-with-layers/3d-layers/3d-layers.html
- [7] Remotion — Three integration: https://www.remotion.dev/docs/three/
- [8] Remotion — Seeded randomness: https://www.remotion.dev/docs/random/

Online research was initially unavailable, then completed using official search results and accessible documentation. Some documentation pages returned only indexed excerpts; the recommendations above distinguish documented capabilities from proposed KamiKami behavior.
