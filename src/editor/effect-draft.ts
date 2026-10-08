import {
  EffectSchema,
  effectSettings,
  resolveEffectInstance,
  validateProject,
  type Effect,
  type Project,
} from "../model";
import { getEffectFamily } from "../builtin-effects";

/** Forks own their recipe and retain access to their source's named presets. */
export function forkEffect(effect: Effect, id: string): Effect {
  if (id === effect.id) throw new Error("A fork must have a new effect ID.");
  return EffectSchema.parse({
    ...effect,
    id,
    name: `${effect.name.slice(0, 73)} (copy)`,
    presetFamilyId: effect.presetFamilyId ?? getEffectFamily(effect.id)?.id,
  });
}

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
  project = validateProject(project);
  const effect = EffectSchema.parse({ ...draft, name: draft.name.trim() });
  if (!effect.name) throw new Error("Enter an effect name before saving.");
  return validateProject({
    ...project,
    effects: existing
      ? project.effects.map((item) => (item.id === effect.id ? effect : item))
      : [...project.effects, effect],
  });
}

/** Instance edits only replace the target's snapshot, preserving strength and enabled state. */
export function applyInstanceEffectDraft(
  project: Project,
  elementId: string,
  draft: Effect,
  original: Effect,
): Project {
  project = validateProject(project);
  const element = project.layers.find((layer) => layer.id === elementId);
  const instance = element?.effects.find((item) => item.effectId === draft.id);
  if (!element || !instance)
    throw new Error(
      "This effect instance was removed. Reopen effect settings.",
    );
  if (
    JSON.stringify(
      EffectSchema.parse(resolveEffectInstance(instance, project.effects)),
    ) !== JSON.stringify(EffectSchema.parse(original))
  )
    throw new Error(
      "This effect instance changed while settings were open. Reopen it to edit the latest version.",
    );
  const effect = EffectSchema.parse({ ...draft, name: draft.name.trim() });
  if (!effect.name) throw new Error("Enter an effect name before saving.");
  if (effect.text && element.type !== "title")
    throw new Error("Text effects can only be applied to text elements.");
  return validateProject({
    ...project,
    layers: project.layers.map((layer) =>
      layer.id !== elementId
        ? layer
        : {
            ...layer,
            effects: layer.effects.map((item) =>
              item.effectId !== draft.id
                ? item
                : { ...item, settings: effectSettings(effect) },
            ),
          },
    ),
  });
}
