# Effect roles

The gallery sorts every effect by the job it does in a shot, not by the engine that draws it (`src/effect-roles.ts`):

| Role | Answers | Feels |
| --- | --- | --- |
| In | How does it arrive? | Build, Reveal, Arrive, Type on |
| Throughout | What does it do while on screen? | Pulse, Drift, Signal, Color, Camera |
| Out | How does it leave? | Break, Conceal, Depart, Type off |
| Overlay | What is drawn around it? | Frame, Annotate, Drafting, Print, Energy, Pattern |
| Style | What is its surface? | Fill, Outline & shadow, Glow, Plate, Copies, Material |
| Arrange | Where do its words sit? | Emphasis, Sequence, Path, Stack |
| Between | How does one shot hand off to the next? | Wipe, Shape, Dissolve, Flash |
| Finish | How is the whole frame treated? | Grade, Light, Texture, Signal, Illustration, Matte |

- `effectRole` reads a table for pass and channel cards, then derives the role from the recipe (text kind, artwork kind, overlay, pass timing), so forks and imported effects sort correctly.
- `effectTarget` is text, picture or any. The gallery's target filter and the dimmed cards for the current selection use it; dragging only highlights clips the card fits.
- Every reversible entrance (kinetic entrances, title-pack entrances and staggered text) also appears under Out as `<id>-out`, its exit played backwards.

## In and Out phases

A clip with In or Out effects shows triangle handles on the timeline at the end of its In phase and the start of its Out phase. Dragging one (or Arrow keys, Shift for 0.1 s) scales the timing parameter of every effect in that phase together — text `seconds`, channel spans, transition `seconds`, artwork slides, overlay draw-ons and depth moves — through the clip's own instance settings, so other clips using the same effect keep their timing. The two phases never overlap.
