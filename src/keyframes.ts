import { z } from "zod";
import type { EffectInstance, Layer } from "./model";

/**
 * Keyframes follow the After Effects / Premiere model: a property is either
 * static or animated (the "stopwatch"). Once animated, its static value is
 * ignored and edits at the playhead create or update keyframes. Each keyframe's
 * easing describes the segment that leaves it, so `hold` keeps its value until
 * the next keyframe.
 *
 * Times are animation seconds: clip-local time plus `effectOffset`, the same
 * clock effects use, so keyframes stay put on the source when a clip is moved,
 * left-trimmed or split.
 */
export const keyframeEasings = [
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "hold",
  "bezier",
] as const;
export type KeyframeEasing = (typeof keyframeEasings)[number];
export const keyframeEasingNames: Record<KeyframeEasing, string> = {
  linear: "Linear",
  "ease-in": "Ease in",
  "ease-out": "Ease out",
  "ease-in-out": "Easy ease",
  hold: "Hold",
  bezier: "Custom curve",
};
export const KeyframeSchema = z
  .object({
    time: z.number().min(0).max(36000),
    value: z.number().min(-100000).max(100000),
    easing: z.enum(keyframeEasings).default("linear"),
    /** CSS-style cubic-bezier control points, used when easing is `bezier`. */
    bezier: z
      .tuple([
        z.number().min(0).max(1),
        z.number().min(-2).max(3),
        z.number().min(0).max(1),
        z.number().min(-2).max(3),
      ])
      .optional(),
  })
  .strict();
export type Keyframe = z.infer<typeof KeyframeSchema>;
export const KeyframeTrackSchema = z.array(KeyframeSchema).min(1).max(240);

export const elementKeyframeProperties = [
  "x",
  "y",
  "scale",
  "rotation",
  "opacity",
  "volume",
] as const;
export type KeyframeProperty = (typeof elementKeyframeProperties)[number];
export const propertyRanges: Record<
  KeyframeProperty,
  { min: number; max: number; label: string }
> = {
  x: { min: -1920, max: 1920, label: "X position" },
  y: { min: -1080, max: 1080, label: "Y position" },
  scale: { min: 0.05, max: 5, label: "Scale" },
  rotation: { min: -360, max: 360, label: "Rotation" },
  opacity: { min: 0, max: 1, label: "Opacity" },
  volume: { min: 0, max: 1, label: "Volume" },
};
export const ElementKeyframesSchema = z
  .object(
    Object.fromEntries(
      elementKeyframeProperties.map((p) => [p, KeyframeTrackSchema.optional()]),
    ) as Record<KeyframeProperty, z.ZodOptional<typeof KeyframeTrackSchema>>,
  )
  .strict();
export const parameterPathPattern = /^[a-zA-Z]+(\.[a-zA-Z0-9]+){0,4}$/;
export const InstanceKeyframesSchema = z
  .object({
    amount: KeyframeTrackSchema.optional(),
    /** Numeric effect-setting paths, e.g. `passes.0.size` or `depth.from`. */
    parameters: z
      .record(
        z.string().max(80).regex(parameterPathPattern),
        KeyframeTrackSchema,
      )
      .refine((r) => Object.keys(r).length <= 24, {
        message: "Animate up to 24 parameters per effect instance",
      })
      .optional(),
  })
  .strict();
export type InstanceKeyframes = z.infer<typeof InstanceKeyframesSchema>;

const presetCurves: Record<string, [number, number, number, number]> = {
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  // After Effects' Easy Ease uses 33% influence on both sides.
  "ease-in-out": [0.33, 0, 0.67, 1],
};
/** Solve a CSS cubic-bezier for progress `u` (Newton with bisection fallback). */
export function cubicBezier(
  [x1, y1, x2, y2]: readonly [number, number, number, number],
  u: number,
) {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const sample = (a: number, b: number, t: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  const slope = (a: number, b: number, t: number) =>
    3 * a * (1 - t) ** 2 + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t * t;
  let t = u;
  for (let i = 0; i < 8; i++) {
    const error = sample(x1, x2, t) - u;
    if (Math.abs(error) < 1e-6) return sample(y1, y2, t);
    const d = slope(x1, x2, t);
    if (Math.abs(d) < 1e-6) break;
    t -= error / d;
  }
  let lo = 0,
    hi = 1;
  t = u;
  for (let i = 0; i < 30; i++) {
    const x = sample(x1, x2, t);
    if (Math.abs(x - u) < 1e-6) break;
    if (x < u) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return sample(y1, y2, t);
}
export function easeKeyframe(keyframe: Keyframe, u: number) {
  if (keyframe.easing === "hold") return 0;
  if (keyframe.easing === "linear") return u;
  const curve =
    keyframe.easing === "bezier"
      ? (keyframe.bezier ?? [0.33, 0, 0.67, 1])
      : presetCurves[keyframe.easing];
  return cubicBezier(curve, u);
}
/** Value of a sorted track; holds the first/last values outside the keyed range. */
export function keyframeValue(track: readonly Keyframe[], time: number) {
  if (time <= track[0].time) return track[0].value;
  const last = track[track.length - 1];
  if (time >= last.time) return last.value;
  let i = 0;
  while (i < track.length - 2 && track[i + 1].time <= time) i++;
  const a = track[i],
    b = track[i + 1];
  const u = (time - a.time) / Math.max(1e-9, b.time - a.time);
  return a.value + (b.value - a.value) * easeKeyframe(a, u);
}
/** Sort by time; a later duplicate at the same frame replaces an earlier one. */
export function normalizeTrack(track: readonly Keyframe[], fps = 24) {
  const byFrame = new Map<number, Keyframe>();
  for (const k of track) byFrame.set(Math.round(k.time * fps), k);
  return [...byFrame.values()].sort((a, b) => a.time - b.time);
}
export const snapTime = (time: number, fps = 24) =>
  Math.max(0, Math.round(time * fps) / fps);
const sameFrame = (a: number, b: number, fps = 24) =>
  Math.abs(a - b) < 0.5 / fps;

export const animationTime = (layer: Layer, localTime: number) =>
  Math.max(0, localTime + layer.effectOffset);

export type KeyframeTarget =
  | { kind: "property"; property: KeyframeProperty }
  | { kind: "amount"; effectId: string }
  | { kind: "parameter"; effectId: string; path: string };

export function targetKey(target: KeyframeTarget) {
  return target.kind === "property"
    ? target.property
    : target.kind === "amount"
      ? `${target.effectId}:amount`
      : `${target.effectId}:${target.path}`;
}

/** Read a numeric path such as `passes.0.size` from effect settings. */
export function getPath(value: unknown, path: string): unknown {
  let node = value;
  for (const part of path.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}
/** Immutable path write; only replaces existing numeric leaves. */
export function setPath<T>(value: T, path: string, n: number): T {
  const [head, ...rest] = path.split(".");
  if (value === null || typeof value !== "object") return value;
  const copy = (Array.isArray(value) ? [...value] : { ...value }) as Record<
    string,
    unknown
  >;
  if (!(head in copy)) return value;
  copy[head] = rest.length
    ? setPath(copy[head], rest.join("."), n)
    : typeof copy[head] === "number"
      ? n
      : copy[head];
  return copy as T;
}
const integerLeaves = new Set(["count", "seed"]);
export const roundsToInteger = (path: string) =>
  integerLeaves.has(path.split(".").at(-1) ?? "");

function instanceOf(layer: Layer, effectId: string) {
  return layer.effects.find((i) => i.effectId === effectId);
}
export function getTrack(
  layer: Layer,
  target: KeyframeTarget,
): Keyframe[] | undefined {
  if (target.kind === "property") return layer.keyframes?.[target.property];
  const keyframes = instanceOf(layer, target.effectId)?.keyframes;
  return target.kind === "amount"
    ? keyframes?.amount
    : keyframes?.parameters?.[target.path];
}
function withInstanceKeyframes(
  instance: EffectInstance,
  change: (k: InstanceKeyframes) => InstanceKeyframes,
): EffectInstance {
  const next = change({ ...(instance.keyframes ?? {}) });
  if (next.parameters && !Object.keys(next.parameters).length)
    delete next.parameters;
  if (!next.amount) delete next.amount;
  const { keyframes: _old, ...rest } = instance;
  return Object.keys(next).length ? { ...rest, keyframes: next } : rest;
}
export function setTrack(
  layer: Layer,
  target: KeyframeTarget,
  track: Keyframe[] | undefined,
): Layer {
  const normalized = track?.length ? normalizeTrack(track) : undefined;
  if (target.kind === "property") {
    const keyframes = { ...(layer.keyframes ?? {}) };
    if (normalized) keyframes[target.property] = normalized;
    else delete keyframes[target.property];
    const { keyframes: _old, ...rest } = layer;
    return Object.keys(keyframes).length ? { ...rest, keyframes } : rest;
  }
  return {
    ...layer,
    effects: layer.effects.map((instance) =>
      instance.effectId !== target.effectId
        ? instance
        : withInstanceKeyframes(instance, (k) => {
            if (target.kind === "amount") k.amount = normalized;
            else {
              const parameters = { ...(k.parameters ?? {}) };
              if (normalized) parameters[target.path] = normalized;
              else delete parameters[target.path];
              k.parameters = parameters;
            }
            return k;
          }),
    ),
  };
}
/** The value used when the target is not animated. */
export function staticValue(layer: Layer, target: KeyframeTarget): number {
  if (target.kind === "property") return layer[target.property];
  const instance = instanceOf(layer, target.effectId);
  if (!instance) return 0;
  if (target.kind === "amount") return instance.amount;
  const n = getPath(instance.settings, target.path);
  return typeof n === "number" ? n : 0;
}
function setStatic(layer: Layer, target: KeyframeTarget, value: number): Layer {
  if (target.kind === "property") return { ...layer, [target.property]: value };
  return {
    ...layer,
    effects: layer.effects.map((instance) =>
      instance.effectId !== target.effectId
        ? instance
        : target.kind === "amount"
          ? { ...instance, amount: value }
          : instance.settings
            ? {
                ...instance,
                settings: setPath(instance.settings, target.path, value),
              }
            : instance,
    ),
  };
}
export function valueAt(
  layer: Layer,
  target: KeyframeTarget,
  localTime: number,
): number {
  const track = getTrack(layer, target);
  return track?.length
    ? keyframeValue(track, animationTime(layer, localTime))
    : staticValue(layer, target);
}
export const propertyAt = (
  layer: Layer,
  property: KeyframeProperty,
  localTime: number,
) => {
  const track = layer.keyframes?.[property];
  return track?.length
    ? keyframeValue(track, animationTime(layer, localTime))
    : layer[property];
};
/** Auto-key: edits at the playhead write a keyframe once a target is animated. */
export function setValueAt(
  layer: Layer,
  target: KeyframeTarget,
  value: number,
  localTime: number,
): Layer {
  const track = getTrack(layer, target);
  if (!track?.length) return setStatic(layer, target, value);
  const time = snapTime(animationTime(layer, localTime));
  const index = track.findIndex((k) => sameFrame(k.time, time));
  const next =
    index >= 0
      ? track.map((k, i) => (i === index ? { ...k, value } : k))
      : [...track, { time, value, easing: easingNear(track, time) }];
  return setTrack(layer, target, next);
}
/** New keys inherit the easing of the segment they split. */
function easingNear(track: Keyframe[], time: number): KeyframeEasing {
  const before = [...track].reverse().find((k) => k.time <= time);
  return before?.easing === "bezier"
    ? "ease-in-out"
    : (before?.easing ?? "linear");
}
/** Stopwatch toggle. Turning animation off keeps the value shown at the playhead. */
export function setAnimated(
  layer: Layer,
  target: KeyframeTarget,
  animated: boolean,
  localTime: number,
): Layer {
  const current = valueAt(layer, target, localTime);
  if (!animated)
    return setStatic(setTrack(layer, target, undefined), target, current);
  if (getTrack(layer, target)?.length) return layer;
  return setTrack(layer, target, [
    {
      time: snapTime(animationTime(layer, localTime)),
      value: current,
      easing: "linear",
    },
  ]);
}
export function keyframeIndexAt(
  layer: Layer,
  target: KeyframeTarget,
  localTime: number,
) {
  const time = animationTime(layer, localTime);
  return (
    getTrack(layer, target)?.findIndex((k) => sameFrame(k.time, time)) ?? -1
  );
}
/** Diamond button: add a key with the current value, or remove the key here. */
export function toggleKeyframe(
  layer: Layer,
  target: KeyframeTarget,
  localTime: number,
): Layer {
  const track = getTrack(layer, target) ?? [];
  const index = keyframeIndexAt(layer, target, localTime);
  if (index < 0) {
    const value = valueAt(layer, target, localTime);
    return setTrack(layer, target, [
      ...track,
      {
        time: snapTime(animationTime(layer, localTime)),
        value,
        easing: track.length
          ? easingNear(track, animationTime(layer, localTime))
          : "linear",
      },
    ]);
  }
  if (track.length === 1)
    return setStatic(
      setTrack(layer, target, undefined),
      target,
      track[0].value,
    );
  return setTrack(
    layer,
    target,
    track.filter((_, i) => i !== index),
  );
}
export function setKeyframeEasing(
  layer: Layer,
  target: KeyframeTarget,
  localTime: number,
  easing: KeyframeEasing,
): Layer {
  const index = keyframeIndexAt(layer, target, localTime);
  const track = getTrack(layer, target);
  if (!track || index < 0) return layer;
  return setTrack(
    layer,
    target,
    track.map((k, i) =>
      i === index
        ? easing === "bezier"
          ? { ...k, easing, bezier: k.bezier ?? [0.33, 0, 0.67, 1] }
          : { time: k.time, value: k.value, easing }
        : k,
    ),
  );
}
export function allTracks(layer: Layer): {
  target: KeyframeTarget;
  track: Keyframe[];
}[] {
  const result: { target: KeyframeTarget; track: Keyframe[] }[] = [];
  for (const property of elementKeyframeProperties) {
    const track = layer.keyframes?.[property];
    if (track?.length)
      result.push({ target: { kind: "property", property }, track });
  }
  for (const instance of layer.effects) {
    if (instance.keyframes?.amount)
      result.push({
        target: { kind: "amount", effectId: instance.effectId },
        track: instance.keyframes.amount,
      });
    for (const [path, track] of Object.entries(
      instance.keyframes?.parameters ?? {},
    ))
      result.push({
        target: { kind: "parameter", effectId: instance.effectId, path },
        track,
      });
  }
  return result;
}
export const hasKeyframes = (layer: Layer) => allTracks(layer).length > 0;
/** Clip-local times of keys that fall inside the visible clip, for timeline diamonds. */
export function visibleKeyframeTimes(layer: Layer, targets?: KeyframeTarget[]) {
  const keys = targets?.map(targetKey);
  const times = new Map<number, number>();
  for (const { target, track } of allTracks(layer)) {
    if (keys && !keys.includes(targetKey(target))) continue;
    for (const k of track) {
      const local = k.time - layer.effectOffset;
      if (local >= -1e-6 && local <= layer.duration + 1e-6)
        times.set(Math.round(local * 24), local);
    }
  }
  return [...times.values()].sort((a, b) => a - b);
}
export function adjacentKeyframe(
  layer: Layer,
  localTime: number,
  direction: -1 | 1,
  targets?: KeyframeTarget[],
) {
  const times = visibleKeyframeTimes(layer, targets);
  return direction > 0
    ? times.find((t) => t > localTime + 0.5 / 24)
    : [...times].reverse().find((t) => t < localTime - 0.5 / 24);
}
/** Move every key at one time (all targets) to another, as when dragging a timeline diamond. */
export function retimeKeyframes(
  layer: Layer,
  fromLocal: number,
  toLocal: number,
): Layer {
  const from = animationTime(layer, fromLocal);
  const to = snapTime(animationTime(layer, toLocal));
  let next = layer;
  for (const { target, track } of allTracks(layer)) {
    if (!track.some((k) => sameFrame(k.time, from))) continue;
    // A moved key replaces a key already sitting on the destination frame.
    const moved = track
      .filter((k) => !sameFrame(k.time, to) || sameFrame(k.time, from))
      .map((k) => (sameFrame(k.time, from) ? { ...k, time: to } : k));
    next = setTrack(next, target, moved);
  }
  return next;
}

type AnyZod = {
  def: { type: string };
  unwrap?: () => AnyZod;
  shape?: Record<string, AnyZod>;
  element?: AnyZod;
  minValue?: number | null;
  maxValue?: number | null;
};
/** Introspect a Zod schema for the numeric range at a settings path. */
export function numberRangeAt(
  schema: unknown,
  path: string,
): { min: number; max: number } | undefined {
  let node = schema as AnyZod | undefined;
  const unwrap = () => {
    while (
      node &&
      ["optional", "default", "nullable", "prefault"].includes(node.def.type) &&
      node.unwrap
    )
      node = node.unwrap();
  };
  for (const part of path.split(".")) {
    unwrap();
    if (!node) return undefined;
    if (node.def.type === "object") node = node.shape?.[part];
    else if (node.def.type === "array" && /^\d+$/.test(part))
      node = node.element;
    else return undefined;
  }
  unwrap();
  if (!node || node.def.type !== "number") return undefined;
  return { min: node.minValue ?? -100000, max: node.maxValue ?? 100000 };
}
