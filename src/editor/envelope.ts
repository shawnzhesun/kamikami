import { resolveEffectInstance } from "../effect-instance";
import { effectRole } from "../effect-roles";
import {
  effectSettings,
  type Effect,
  type EffectInstance,
  type Layer,
  type Project,
} from "../model";

/**
 * The In and Out phases of a clip: how long its arrival and departure
 * effects run. Each effect keeps its own timing parameter; the phase is the
 * longest of them, and retiming a phase scales all of them together so
 * stacked entrances (or exits) stay in sync.
 */
export type Phase = "in" | "out";

/** Seconds an effect spends arriving or leaving, if it has a fixed length. */
export function phaseSeconds(effect: Effect): number | null {
  const lengths: number[] = [];
  if (effect.text) lengths.push(effect.text.seconds);
  if (effect.art && (effect.art.timing === "in" || effect.art.timing === "out"))
    lengths.push(effect.art.seconds);
  if (
    effect.overlay &&
    (effect.overlay.timing === "in" || effect.overlay.timing === "out")
  )
    lengths.push(effect.overlay.seconds);
  for (const c of effect.channels)
    if (c.seconds !== undefined) lengths.push(c.seconds);
  for (const p of effect.passes ?? [])
    if (p.timing === "in" || p.timing === "out") lengths.push(p.seconds);
  if (effect.depth) lengths.push(effect.depth.seconds);
  return lengths.length ? Math.max(...lengths) : null;
}

function scaled(effect: Effect, k: number): Effect {
  const s = (v: number, min = 0.05) =>
    Math.min(30, Math.max(min, Math.round(v * k * 1000) / 1000));
  return {
    ...effect,
    ...(effect.text
      ? { text: { ...effect.text, seconds: s(effect.text.seconds) } }
      : {}),
    ...(effect.art &&
    (effect.art.timing === "in" || effect.art.timing === "out")
      ? { art: { ...effect.art, seconds: s(effect.art.seconds, 0.02) } }
      : {}),
    ...(effect.overlay &&
    (effect.overlay.timing === "in" || effect.overlay.timing === "out")
      ? {
          overlay: {
            ...effect.overlay,
            seconds: s(effect.overlay.seconds, 0.02),
          },
        }
      : {}),
    ...(effect.depth
      ? { depth: { ...effect.depth, seconds: s(effect.depth.seconds) } }
      : {}),
    channels: effect.channels.map((c) =>
      c.seconds !== undefined ? { ...c, seconds: s(c.seconds) } : c,
    ),
    ...(effect.passes
      ? {
          passes: effect.passes.map((p) =>
            p.timing === "in" || p.timing === "out"
              ? { ...p, seconds: s(p.seconds) }
              : p,
          ),
        }
      : {}),
  };
}

type PhaseUse = { instance: EffectInstance; effect: Effect; seconds: number };
/** The clip's enabled effects that run in a phase, with their lengths. */
export function phaseEffects(
  layer: Layer,
  effects: Effect[],
  phase: Phase,
): PhaseUse[] {
  return layer.effects.flatMap((instance) => {
    if (!instance.enabled) return [];
    const effect = resolveEffectInstance(instance, effects);
    if (!effect || effectRole(effect).role !== phase) return [];
    const seconds = phaseSeconds(effect);
    return seconds === null ? [] : [{ instance, effect, seconds }];
  });
}
/** Lengths of a clip's In and Out phases, capped to the clip. */
export function phaseLengths(layer: Layer, effects: Effect[]) {
  const length = (phase: Phase) => {
    const uses = phaseEffects(layer, effects, phase);
    return uses.length
      ? Math.min(layer.duration, Math.max(...uses.map((u) => u.seconds)))
      : null;
  };
  return { in: length("in"), out: length("out") };
}
/**
 * Retimes a phase on one clip. Instances get their own settings snapshot, so
 * other clips sharing the effect keep their timing.
 */
export function setPhaseLength(
  project: Project,
  layerId: string,
  phase: Phase,
  seconds: number,
): Project {
  const layer = project.layers.find((l) => l.id === layerId);
  if (!layer) return project;
  const uses = phaseEffects(layer, project.effects, phase);
  if (!uses.length) return project;
  const current = Math.max(...uses.map((u) => u.seconds));
  const other =
    phaseLengths(layer, project.effects)[phase === "in" ? "out" : "in"] ?? 0;
  // The two phases share the clip; keep a sliver of hold between them.
  const target = Math.max(0.05, Math.min(seconds, layer.duration - other, 30));
  const k = target / Math.max(0.001, current);
  return {
    ...project,
    layers: project.layers.map((l) =>
      l.id !== layerId
        ? l
        : {
            ...l,
            effects: l.effects.map((instance) => {
              const use = uses.find((u) => u.instance === instance);
              return use
                ? {
                    ...instance,
                    settings: effectSettings(scaled(use.effect, k)),
                  }
                : instance;
            }),
          },
    ),
  };
}
