# Independent effect instances

The previous model stored all editable parameters in `project.effects`. An applied effect held only its preset ID, strength and enabled state. Every renderer followed that shared reference, so editing the definition changed all elements using it.

An applied effect now stores a complete settings snapshot:

```json
{
  "effectId": "text-neon",
  "amount": 1,
  "enabled": true,
  "settings": {
    "name": "Green neon",
    "description": "...",
    "channels": [],
    "color": "#f2765e",
    "tint": 0,
    "text": { "kind": "neon", "color": "#00ff00", "...": "remaining text settings" }
  }
}
```

The abbreviated text object above illustrates the shape; the actual settings use the same validated schema as a full effect definition, excluding its ID. Settings are a complete snapshot rather than sparse overrides: omitted optional passes or typography never inherit later changes from the preset.

## Ownership and editing

- `project.effects` holds reusable project presets. The effect library continues to provide built-in, saved and imported presets.
- Applying a preset clones its settings separately for each selected element. Applying an already attached preset is still idempotent; it does not reset that instance.
- Clicking an applied effect opens an instance draft with parameter controls only: no editable name, Fork, Delete, or Save to My effects action. Save replaces only that element's settings. Cancel, Escape and close discard the draft. Strength and enabled state remain separate and are preserved.
- Double-clicking a built-in or imported library card opens its read-only General overview. Fork in the header creates a new copy in My effects and opens it for editing. Original library recipes never use project overrides. Double-clicking My effects opens an editable name and parameter controls; Save changes updates its defaults for future applications only.
- My effects settings show an editable name, Fork and Delete in the header. Delete removes the saved preset without changing project definitions or applied instances. The library retains a deleted-ID marker so project autosync and reopening older projects cannot recreate the card. Saving another copy creates a new ID.
- The preset picker shows named starting points with previews. Selecting one replaces all parameters; subsequent manual adjustments remain editable without a Custom mode. Forks retain `presetFamilyId` so their named starting points remain available after save/reload.
- Forking a library or personal preset creates a new preset ID. Instance modals do not offer forking or saving presets. Effect modals do not offer export actions. Import remaps the bundle ID as before.
- Instances are addressed by element ID plus preset ID. The existing one-instance-per-preset-per-element rule remains; repeated applications of the same preset on one element are outside this change.

Full snapshots repeat a small amount of recipe data, but avoid cascading edits and make saved projects independent of subsequent preset changes. Project-level preset references remain required for identity and provenance.

## Rendering and persistence

`resolveEffectInstance` is the single resolver for curves, graphic passes, text animation and tint. It returns instance settings, with a legacy fallback for unnormalized input. Canvas bounds also use the same resolved curve evaluation.

Project JSON is version 2. Loading version 1 first resolves existing preset definitions (including recovery of stripped built-in typography), then copies their current settings into every instance. Existing appearance is preserved. New JSON retains snapshots through local recovery, explicit file saves, reloads, duplication, trimming and splitting. Older applications reject the project version instead of stripping the new data. Portable effect bundles stay version 1 because each bundle contains one fully resolved recipe, not timeline instances.

The local service advertises project version 2 and effect library version 2. Library operations require the latter so stale services cannot resurrect deleted presets or receive unsupported delete requests. The renderer checks this before saving or rendering a project, preventing an older service from discarding instance settings. The native JSON file handler accepts both project versions. Restart the desktop development process once after upgrading its native file handler.

All changes still use the project history: one modal save is one undo step. Saving rejects missing or concurrently changed instances while preserving unrelated changes, including strength and enabled state.

## Assistant/MCP behavior

`update_effect_instance(layerId, effectId, patch, expectedRevision)` targets one applied effect. The patch can change name, description, channels, passes, tint/color and typography. `update_effect` edits local presets for future applications; the editor rejects updates targeting built-in or imported library originals. Create a recipe with a new ID to fork one. Capabilities expose both schemas and the assistant prompt describes the distinction.

## Verification

Tests cover independently colored Neon instances, channel and graphic-pass isolation, unchanged presets and siblings, legacy migration, JSON round-trips, duplicate/split persistence, Undo/Redo, stale drafts, schema validation and targeted agent edits. Existing file-access tests exercise version-2 native saves. The UI smoke test edits local names and typography parameters and verifies that presets stay unchanged.
