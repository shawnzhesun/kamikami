# Effect library consolidation

Reviewed October 7, 2026: all 36 built-in recipes and the three saved recipes in the local library. This consolidation reduced the gallery to **30 built-in cards**, plus the existing saved recipes. The subsequent [videoplayback.mp4 study](videoplayback-effects.md) adds four new operations for a total of **34**. Later additions brought the gallery to 41 (scene recipes), 43 (motion) and 57 ([spring, illustration and 3D-look cards](style-effects.md)).

## Consolidated families

| New card         | Previous cards / variations                     | Parameters that distinguish them                                                                                                 |
| ---------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Color flash      | White flash in; Red flash in                    | Flash color and duration; optional bloom strength and duration. The white recipe included bloom, whereas the red recipe did not. |
| Color silhouette | Red silhouette; Shadow silhouette               | Color. Both preserve the drawing's alpha.                                                                                        |
| Color grade      | Sunset memory; Midnight teal                    | Highlight/shadow colors, grade strength, contrast, saturation, vignette, and optional bloom.                                     |
| Scene light      | Paper spotlight; Horizon flare; Warm light wash | Strength, color, size, and motion of the spotlight, flare, and vignette components. Unused components have zero strength.        |
| Camera zoom      | Slow push; Scene pullback                       | Start/end scale and interpolation curve.                                                                                         |

Double-click a card or inspect an applied effect to choose its **Variation**. This loads the original look's parameters into the shared controls. Any color and numeric value remains editable; changed settings show **Custom**. Selecting another variation resets those parameters. The existing warning that definition edits affect every element using the definition still applies.

Searching the previous card names finds the consolidated card. Existing project definitions keep their original IDs, names, parameters, and timeline references. The old definitions remain in the compatibility registry but no longer occupy separate gallery cards. Saved/imported effects are not automatically deleted, renamed, or merged. Copies saved to My effects retain their editable parameters; the built-in variation selector is associated with built-in IDs.

## Retained built-ins

Sharing a component does not always make two recipes equivalent. These 25 cards remain available:

| Cards                                                                        | Reason to keep                                                                                                                                                               |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Memory vignette; Soft highlight bloom; Print grain; Chromatic fringe         | Focused building blocks useful on their own or in other combinations. They also appear as optional components inside broader recipes.                                        |
| CRT phosphor; Broken TV signal                                               | Different combinations: scanlines/grain/bloom versus displacement/RGB separation/scanlines. Combining them would turn a focused recipe into a general signal-effects editor. |
| Diagonal print screen; Hexagon field; Floating paper flecks; Cinematic matte | Distinct generated shapes, textures, and framing behavior.                                                                                                                   |
| Cutout echoes                                                                | Spatial copies of the current drawing, rather than recoloring or moving a single drawing.                                                                                    |
| Title fragments out; Soft iris in; Graphic panel in; Fade to dark            | Different transition geometry: breakup, circular masking, panel masking, and opacity fading.                                                                                 |
| Focus pull in; Impact zoom; Whip slide in                                    | Focus-only blur, zoom/blur/RGB impact, and lateral entry with spatial echoes. Their combined components give them distinct uses.                                             |
| Held-frame jitter; Drawing pan; Orbiting composition; Angled picture plane   | Held random movement, lateral camera movement, in-plane rotation, and perspective rotation.                                                                                  |
| Kinetic title entry                                                          | Text-specific spacing, movement, focus, and opacity choreography.                                                                                                            |
| Night drift; Signal pulse                                                    | A horizontal oscillation with breathing brightness versus brightness pulsing without position movement.                                                                      |

Flash and silhouette use the same color-replacement primitive internally, but remain separate user-facing recipes: a timed transition with optional bloom versus a continuous cutout treatment. Both expose timing and color controls.

## Saved recipes reviewed

| Saved recipe     | Overlap and decision                                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Retro title sway | Related to Night drift, but combines horizontal motion with phase-offset rotation instead of brightness breathing. Preserved.                                         |
| Memory flicker   | Related to Signal pulse, but adds horizontal oscillation, with independent frequencies. Preserved.                                                                    |
| Retro TV Signal  | Related to the TV treatments by intent, but uses position instability, blur, scale, and brightness modulation instead of generated scanlines/displacement. Preserved. |

These can be authored as combinations of controls in a future general effect builder, but merging them now would lose the convenience of their different motion recipes.

## Verification

Automated tests check gallery counts and alias search, preservation of all legacy definitions, equivalent active passes and channel output for each variation, JSON/bundle round trips, custom-state detection after parameter edits, independent copies of defaults, and saved-library compatibility. Browser verification remains subject to the Chromium launch restriction in the development environment.
