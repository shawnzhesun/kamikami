import type { Effect, EffectInstance } from "./model";
import { getPath, keyframeValue, roundsToInteger, setPath } from "./keyframes";

/** Snapshots are complete settings, never partial overrides inherited from a preset. */
export function resolveEffectInstance(
  instance: EffectInstance,
  effects: Effect[],
): Effect | undefined {
  return instance.settings
    ? { ...instance.settings, id: instance.effectId }
    : effects.find((effect) => effect.id === instance.effectId);
}

/** Strength at an animation time (clip-local seconds plus effectOffset). */
export function instanceAmountAt(instance: EffectInstance, time: number) {
  const track = instance.keyframes?.amount;
  return track?.length
    ? Math.max(0, Math.min(2, keyframeValue(track, time)))
    : instance.amount;
}

/** Settings with keyframed numeric parameters evaluated at an animation time. */
export function resolveEffectInstanceAt(
  instance: EffectInstance,
  effects: Effect[],
  time: number,
): Effect | undefined {
  let effect = resolveEffectInstance(instance, effects);
  const parameters = instance.keyframes?.parameters;
  if (!effect || !parameters) return effect;
  for (const [path, track] of Object.entries(parameters)) {
    if (!track.length || typeof getPath(effect, path) !== "number") continue;
    const value = keyframeValue(track, time);
    effect = setPath(
      effect,
      path,
      roundsToInteger(path) ? Math.round(value) : value,
    );
  }
  return effect;
}
