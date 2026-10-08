import {
  EffectSchema,
  validateProject,
  type Effect,
  type Project,
} from "../model";

// Compare only this definition so unrelated project edits are preserved.
export function applyEffectDraft(
  project: Project,
  draft: Effect,
  original: Effect | undefined,
): Project {
  const existing = project.effects.find((effect) => effect.id === draft.id);
  if (JSON.stringify(existing) !== JSON.stringify(original)) {
    throw new Error(
      "This effect changed while settings were open. Reopen it to edit the latest version.",
    );
  }
  const effect = EffectSchema.parse({ ...draft, name: draft.name.trim() });
  if (!effect.name) throw new Error("Enter an effect name before saving.");
  return validateProject({
    ...project,
    effects: existing
      ? project.effects.map((item) => (item.id === effect.id ? effect : item))
      : [...project.effects, effect],
  });
}
