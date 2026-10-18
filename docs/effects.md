# Effects

An effect is a declarative recipe (`EffectSchema` in `src/model.ts`). No code, shaders or plugins. Every effect is a pure function of the frame, settings and seed, so previews and exports match.

## Recipe sections

An effect has `id`, `name`, `description`, an optional `presetFamilyId`, and any mix of these sections:

| Section | What it does | Reference |
| --- | --- | --- |
| `channels` | Curves on transform and filter properties | [visual-effects.md](visual-effects.md#channels-and-curves) |
| `passes` | SVG graphics: light, texture, cutouts, reveals, particles | [visual-effects.md](visual-effects.md#passes) |
| `depth` | Moves a flat element through perspective and focus | [visual-effects.md](visual-effects.md#depth-particles-and-fields) |
| `text` | Text animation, kinetic type, treatments, layouts (text only) | [text-effects.md](text-effects.md) |
| `art` | Camera moves and copy treatments | [visual-effects.md](visual-effects.md#artwork-treatments) |
| `overlay` | Vector marks drawn around an element | [overlays.md](overlays.md) |
| `origin` | Transform pivot, `{x, y}` from -1 to 1 | — |
| `color`, `tint` | Legacy color wash (a rectangle on non-text elements) | — |

Counts, kinds and ranges aren't listed in these docs. The schemas are the source of truth, and agents read them live: `get_capabilities` (schemas, limits, a library overview by role and feel), `find_effects` and `describe_effect` (one card's settings, ranges, meanings and variations).

## Roles, feels and targets

Every effect has one **role** and a **feel** within it. Both come from `effectRole()` in `src/effect-roles.ts`. The gallery tabs and the agents' `find_effects` use them.

| Role | Means |
| --- | --- |
| `in` | How it arrives |
| `throughout` | While it's on screen |
| `out` | How it leaves |
| `overlay` | Graphics drawn around it |
| `style` | Its surface |
| `arrange` | Where its words sit |
| `between` | Hand-off to the next shot |
| `finish` | Grade and texture |

Feels per role are in `roleFeels`; overlay feels are the overlay sections.

- **Composing:** build a shot from about one card per role.
- **Exits:** reversible entrances also exist as exits with the ID suffix `-out` (`text.motion.direction: "out"`).
- **Retiming:** the timeline's In/Out handles scale the timing of all of a clip's In or Out effects together (`src/editor/envelope.ts`).

**Targets** (`effectTarget`):

- `text`: anything with `effect.text`; text elements only.
- `picture`: artwork `trail` and `slices`; images, video, shapes, scenes and backdrops.
- `any`: everything else, for any visual element.

Audio takes no effects. Mismatches are refused with a readable message.

## Library

`builtinEffects` (`src/builtin-effects.ts`, with overlay cards from `src/overlay-cards.ts`) holds the cards.

- **Variations:** many cards are families with named variations. Applying a variation writes its settings into the instance; the card stays the preset. In the UI this is the preset picker; agents pass `apply_effect { variationId }`.
- **Legacy cards:** retired IDs stay resolvable through `allBuiltinEffects`, so old projects keep working.
- **Read-only originals:** library cards can't be edited. Fork one to My effects (a new ID, keeping `presetFamilyId`), or create one with `create_effect`.

## Engines

A bundle or recipe declares the lowest engine it needs. `effectEngine()` in `src/effect-bundle.ts` computes it from the `usesV*Features` checks in `src/visual-effects.ts`. Older readers reject newer recipes instead of dropping their settings.

| Engine | Adds |
| --- | --- |
| `frameforge-curves-v1` | Channels x/y/scale/rotation/opacity/blur/brightness; curves linear/ease/sine/pulse |
| `kamikami-visual-v2` | Passes; contrast, saturation, letterSpacing, rotateY; ease-out, shake, steps |
| `kamikami-visual-v3` | Palette, smear, repeat and rings passes; pass mode fields; `count` |
| `kamikami-visual-v4` | `text` recipes; blinds |
| `kamikami-visual-v5` | `depth`, `text.motion` and `text.glitch`, the title unit, depth/scatter/spiral styles, pass `field`/`particles` |
| `kamikami-visual-v6` | Warp, bevel, extrude, sheen, paper, ink, pixel, dissolve, goo, glow and lens passes; scaleX/scaleY/skewX/rotateX; spring curves; channel `seconds`/`align` |
| `kamikami-visual-v7` | Title text kinds, `text.direction`/`variant`, `origin`; shape, doors, clock, feather, lumawipe, reflection, tiltshift, oldfilm, ripple and cells passes |
| `kamikami-visual-v8` | `art`, `overlay`, kinetic/look/layout text kinds, `text.tempo`/`angle`, stagger order center/edges |
| `kamikami-visual-v9` | The riso print pass (`riso`, `risoInks`, `risoPaper`, `registration`, `inkGrain`) and the halftone wash overlay (`halftonewash`) |

The ladder is `effectEngines` in `src/visual-effects.ts`; a new engine is appended there and gated in `effectEngine`.

**Pack-only kinds** (`packOnlyPassKinds`, `packOnlyOverlayKinds`) are engine features with no built-in card; their presets ship in effect packs, such as `examples/effects/riso.kamikami-effects.json`. Agents still build recipes with them from the schemas in `get_capabilities`.

## Bundles and packs

Effects travel as JSON files. Both kinds import from **Import effects** in the Effects tab (several files at once) or through `import_effect_bundle`.

**Packs** (`.kamikami-effects.json`, `EffectPackSchema` in `src/effect-bundle.ts`) hold several effects. **Export effects** and `export_effect_bundle` write them.

```json
{ "format": "kamikami-effect-pack", "version": 1, "engine": "kamikami-visual-v8",
  "id": "neon-nights", "name": "Neon nights", "author": "…", "description": "…",
  "effects": [ { "effect": { … } }, { "author": "…", "effect": { … } } ] }
```

- `id` names the pack across versions. Importing a pack whose ID is installed updates it in place: its effects keep their library IDs, so projects and agents still find them; new effects are added and dropped ones removed. Exporting an imported pack under its own name keeps its ID.
- `engine` is the newest one any of its effects needs (`packEngine`). Effect IDs must be unique within the pack. An effect's `author` is written only where it differs from the pack's.
- **No licenses.** Every shared effect is free to use and share, so effect files carry no license. A `license` in an older file is ignored.
- An installed pack is a collection in the library filter. Removing it takes its effects out of the library; elements that use them keep their copies, and importing the file again restores the same IDs.

**Single-effect bundles** (`.kamikami-effect.json`, `EffectBundleSchema`) are the older format, and still import (as do `.frameforge-effect.json` files):

```json
{ "format": "frameforge-effect", "version": 1, "engine": "kamikami-visual-v8",
  "name": "…", "author": "…", "description": "…", "effect": { … } }
```

- Import remaps effect IDs. Legacy decorations are migrated on import.
- A bundle's engine must be at least `effectEngine(effect)`.
- My effects and imported effects are stored in `.kamikami/effects.json`, separate from the project and from undo.
