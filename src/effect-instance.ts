import type { Effect, EffectInstance } from "./model";

/** Snapshots are complete settings, never partial overrides inherited from a preset. */
export function resolveEffectInstance(
  instance: EffectInstance,
  effects: Effect[],
): Effect | undefined {
  return instance.settings
    ? { ...instance.settings, id: instance.effectId }
    : effects.find((effect) => effect.id === instance.effectId);
}
