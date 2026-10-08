# Remotion scenes catalog review

Reviewed on October 8, 2026. Reference: [lifeprompt-team/remotion-scenes](https://github.com/lifeprompt-team/remotion-scenes), particularly its [TextAnimations](https://github.com/lifeprompt-team/remotion-scenes/tree/main/src/scenes/TextAnimations) and [TransitionAnimations](https://github.com/lifeprompt-team/remotion-scenes/tree/main/src/scenes/TransitionAnimations) catalogs.

The public indexed catalog was available during this review. Direct GitHub source retrieval and cloning were unavailable, so these are original KamiKami implementations inspired by the named animation techniques, not ports or a claim of frame-for-frame reproduction. No third-party implementation code or assets were copied. This is a selected set of reusable effects, not a conversion of every full-scene template.

| Reference techniques | KamiKami addition | Adjustable controls |
| --- | --- | --- |
| TextTypewriter | Typewriter | Character/word unit, duration, cursor; instance strength |
| TextScramble | Text scramble | Character/word unit, duration, scramble speed, seed; instance strength |
| TextSplit, Text3DFlip (plus native rise/pop modes) | Staggered text | Rise/3D flip/pop, character/word unit, duration, stagger, rise height |
| TextWave | Text wave | Character/word unit, height, speed, phase spacing |
| TextGradient | Flowing text gradient | Two colors, speed, instance strength |
| TextNeon | Neon text | Inner/outer glow colors, glow size, pulse speed, instance strength |
| TransitionBlinds | Blinds reveal | Horizontal/vertical strips, count, strength, timing, duration |

All text previews show **Title**. Text recipes are applied to title elements; image/video/audio drops are rejected. The timeline, video renderer and library thumbnails share the same text-animation component. Fonts, original text and line breaks remain stored on the element. Grapheme segmentation keeps combining marks and emoji sequences together. Moving character runs are individual spans; gradient and neon alone retain the original continuous text run and its font shaping.

## Duplicate avoidance

No extra cards were added for whole-title fade/slide/blur, text glitch, fragment breakup, geometric wipes, iris/zoom reveals, RGB split, film grain or basic particles. Existing Kinetic title entry, Broken TV signal, Fragment breakup, Panel wipe, Iris reveal, Camera zoom, Chromatic fringe, Print grain and Particles already cover those treatments. Staggered text consolidates three entry styles in one card; Blinds reveal consolidates both orientations.

Counter/data scenes, charts, preset text content and multi-element layouts are composition templates rather than effects on arbitrary timeline elements, so they were not imported into the effects library.

## Persistence and timing

The six typography recipes use the optional `Effect.text` schema. Blinds adds a visual-pass kind and an orientation parameter. Both require `kamikami-visual-v4` bundles, while existing v1/v2/v3 bundles remain supported. The project format remains version 1; open projects with these recipes in this version or newer. The per-project limit remains 40 definitions; the gallery now has 41 selectable cards.

All motion derives from clip-local seconds plus the element's retained effect offset. Trimming and splitting do not restart animations, and scrambles use a deterministic seed rather than wall-clock randomness. Entry durations clamp to the original clip duration. Disabled effects and zero instance strength bypass text processing. Effect settings use the existing draft modal and commit as one undoable change.


## Text rendering regression fixes

Text previews use a fixed dark stage and larger lettering across light and dark themes. Gradient paint is applied directly to text leaves when combined with per-character transforms, avoiding transparent ancestor clipping. Idle glyphs do not carry unnecessary perspective transforms.

Known built-in IDs whose `text` fields were stripped by an older service recover their defaults during project validation. Explicit custom settings are preserved. Write/export requests carrying text effects check the local service version first, and the development service watches source changes. Restart an already running older development launcher once to load these changes.

`npm run test:text-render` exercises individual and combined effects in Chromium, counts visible screenshot pixels, and captures previews for every theme. It needs a host that permits the bundled browser to launch. Typewriter and staggered entrances intentionally begin hidden at time zero; visibility is checked during and after their entrance.
