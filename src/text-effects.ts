import { z } from "zod";
import { clamp01, effectRandom } from "./visual-effects";
import { instanceAmountAt, resolveEffectInstanceAt } from "./effect-instance";
import type { Effect, Layer } from "./model";
import { projectDepth, seeded, unit, ease } from "./motion";
import { titleKinds, titleNames } from "./title-effects";

export const textEffectKinds = [
  "typewriter",
  "scramble",
  "stagger",
  "wave",
  "gradient",
  "neon",
  "glitch",
] as const;
export const allTextKinds = [...textEffectKinds, ...titleKinds] as const;
export const textEffectNames: Record<(typeof allTextKinds)[number], string> =
  {
    ...titleNames,
    typewriter: "Typewriter",
    scramble: "Text scramble",
    stagger: "Staggered text",
    wave: "Text wave",
    gradient: "Flowing text gradient",
    neon: "Neon text",
    glitch: "Text glitch",
  };
export const TextEffectSchema = z
  .object({
    kind: z.enum(allTextKinds),
    seconds: z.number().min(0.05).max(30).default(1.5),
    stagger: z.number().min(0).max(0.95).default(0.6),
    distance: z.number().min(0).max(3).default(0.6),
    speed: z.number().min(0).max(10).default(1),
    style: z
      .enum(["rise", "flip", "pop", "depth", "scatter", "spiral"])
      .default("rise"),
    unit: z.enum(["character", "word", "title"]).default("character"),
    motion: z
      .object({
        depth: z.number().min(-0.8).max(8).default(3),
        spread: z.number().min(0).max(8).default(2),
        rotation: z.number().min(0).max(360).default(90),
        order: z.enum(["forward", "reverse", "random"]).default("forward"),
        direction: z.enum(["in", "out"]).default("in"),
        easing: z.enum(["linear", "smooth", "ease-out"]).default("smooth"),
      })
      .strict()
      .optional(),
    glitch: z
      .object({
        timing: z
          .enum(["continuous", "entrance", "exit"])
          .default("continuous"),
        affected: z.number().min(0).max(1).default(0.5),
        burst: z.number().min(0.01).max(1).default(0.2),
        jitter: z.number().min(0).max(2).default(0.2),
        slices: z.number().min(0).max(2).default(0.15),
        rgb: z.number().min(0).max(0.5).default(0.05),
        dropout: z.number().min(0).max(1).default(0.05),
        substitute: z.boolean().default(false),
        alphabet: z
          .string()
          .max(200)
          .default("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&"),
      })
      .strict()
      .optional(),
    /** Title kinds: mask/swipe/turn travel direction. */
    direction: z.enum(["up", "down", "left", "right"]).optional(),
    /** Title kinds: named look within a kind (focus, bounce, highlight). */
    variant: z
      .enum(["soft", "slam", "bounce", "elastic", "marker", "block"])
      .optional(),
    cursor: z.boolean().default(true),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default("#f2765e"),
    secondary: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default("#66a3bf"),
    seed: z.number().int().min(0).max(65535).default(17),
  })
  .strict();
export type TextEffect = z.infer<typeof TextEffectSchema>;
const defaultGlitch = TextEffectSchema.parse({
  kind: "glitch",
  glitch: {},
}).glitch!;

// Shared defaults also recover known built-ins saved by pre-text-effect services.
export const builtinTextSettings: Record<string, TextEffect> = {
  "text-typewriter": TextEffectSchema.parse({ kind: "typewriter" }),
  "text-scramble": TextEffectSchema.parse({ kind: "scramble" }),
  "text-stagger": TextEffectSchema.parse({ kind: "stagger" }),
  "text-wave": TextEffectSchema.parse({
    kind: "wave",
    stagger: 0.13,
    distance: 0.25,
    speed: 0.7,
  }),
  "text-gradient": TextEffectSchema.parse({ kind: "gradient", speed: 0.45 }),
  "text-neon": TextEffectSchema.parse({
    kind: "neon",
    color: "#ed96d7",
    secondary: "#8e1ea2",
    distance: 0.6,
    speed: 1.4,
  }),
  "text-glitch": TextEffectSchema.parse({
    kind: "glitch",
    speed: 3,
    glitch: {},
  }),
};

export type ActiveTextEffect = { effect: TextEffect; amount: number };

/** `time` is clip-local seconds; keyframed strength and parameters are evaluated there. */
export function activeTextEffects(
  layer: Layer,
  effects: Effect[],
  time = 0,
): ActiveTextEffect[] {
  if (layer.type !== "title") return [];
  const animation = textEffectTime(layer, time);
  return layer.effects.flatMap((instance) => {
    const effect = resolveEffectInstanceAt(instance, effects, animation)?.text;
    const amount = instanceAmountAt(instance, animation);
    return effect && instance.enabled && amount > 0
      ? [{ effect, amount: clamp01(amount) }]
      : [];
  });
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
export function textUnits(text: string, unit: TextEffect["unit"]) {
  return unit === "word"
    ? text.split(/(\s+)/u).filter(Boolean)
    : Array.from(segmenter.segment(text), ({ segment }) => segment);
}

/** Clip-local seconds plus the retained source offset keep trims and splits continuous. */
export function textEffectTime(layer: Layer, time: number) {
  return Math.max(0, time + layer.effectOffset);
}
export function textUnitFrame(
  effect: TextEffect,
  time: number,
  index: number,
  count: number,
  duration: number,
  amount = 1,
) {
  const strength = clamp01(amount);
  const seconds = Math.min(effect.seconds, Math.max(0.05, duration));
  const progress = clamp01(time / seconds);
  const order = effect.motion?.order;
  const position =
    order === "reverse"
      ? count - 1 - index
      : order === "random"
        ? seeded(effect.seed, index) * Math.max(0, count - 1)
        : index;
  const delay = count > 1 ? (position / (count - 1)) * effect.stagger : 0;
  const p =
    effect.motion?.direction === "out"
      ? unit((time - (duration - seconds)) / seconds)
      : progress;
  const entry = ease(
    (p - delay) / (1 - effect.stagger),
    effect.motion?.easing ?? "smooth",
  );
  const remaining = effect.motion?.direction === "out" ? entry : 1 - entry;
  let opacity = 1,
    y = 0,
    x = 0,
    rotation = 0,
    rgb = 0,
    slice = 0,
    rotateX = 0,
    scale = 1,
    scramble = false;
  if (effect.kind === "typewriter")
    opacity = index < Math.floor(progress * count) ? 1 : 1 - strength;
  if (effect.kind === "scramble")
    scramble = index >= Math.floor(progress * count) && strength > 0;
  if (effect.kind === "stagger") {
    opacity = 1 - remaining * strength;
    if (effect.style === "rise") y = remaining * effect.distance * strength;
    if (effect.style === "flip") rotateX = -90 * remaining * strength;
    if (effect.style === "pop") scale = 1 - 0.75 * remaining * strength;
    if (["depth", "scatter", "spiral"].includes(effect.style)) {
      const motion = effect.motion;
      const q = remaining * strength;
      const radius = (motion?.spread ?? 2) * q;
      const angle =
        seeded(effect.seed, index) * Math.PI * 2 +
        (effect.style === "spiral" ? q * Math.PI * 4 : 0);
      const d = projectDepth(
        effect.style === "depth" ? 0 : Math.cos(angle) * radius,
        effect.style === "depth" ? 0 : Math.sin(angle) * radius,
        (motion?.depth ?? 3) * q,
      );
      x = d.x;
      y = d.y;
      scale = d.scale;
      opacity *= d.opacity;
      rotation =
        (seeded(effect.seed, index + 193) * 2 - 1) *
        (motion?.rotation ?? 90) *
        q;
      rotateX = q * 60;
    }
  }
  if (effect.kind === "wave")
    y =
      Math.sin(
        time * effect.speed * Math.PI * 2 -
          index * effect.stagger * Math.PI * 2,
      ) *
      effect.distance *
      strength;
  if (effect.kind === "glitch") {
    const g = effect.glitch ?? defaultGlitch;
    const eligible =
      g.timing === "continuous" ||
      (g.timing === "entrance" ? time < seconds : time >= duration - seconds);
    const tick = Math.floor(time * effect.speed);
    const active =
      eligible &&
      effect.speed > 0 &&
      time * effect.speed - tick < Math.min(1, g.burst * effect.speed) &&
      seeded(effect.seed + tick * 97, index) < g.affected;
    if (active && strength > 0) {
      const sign = seeded(effect.seed + tick, index + 51) * 2 - 1;
      x = sign * g.jitter * strength;
      y =
        (seeded(effect.seed + tick, index + 81) - 0.5) *
        g.jitter *
        strength *
        0.4;
      slice = sign * g.slices * strength;
      rgb = g.rgb * strength;
      opacity =
        seeded(effect.seed + tick, index + 107) < g.dropout ? 1 - strength : 1;
      scramble = g.substitute && strength > 0;
    }
  }
  return {
    opacity,
    x,
    y,
    rotation,
    rgb,
    slice,
    rotateX,
    scale,
    scramble,
    progress,
  };
}

const scrambleAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&";
export function scrambledText(
  original: string,
  seed: number,
  index: number,
  time: number,
  speed: number,
  alphabet = scrambleAlphabet,
) {
  const glyphs = textUnits(alphabet || scrambleAlphabet, "character").filter(
    (v) => !/^\s+$/u.test(v),
  );
  if (!glyphs.length) return original;
  // Preserve whitespace and one grapheme's layout; replacements never mutate the source text.
  return /^\s+$/u.test(original)
    ? original
    : textUnits(original, "character")
        .map((_, i) => {
          const n = effectRandom(
            seed,
            Math.floor(time * speed * 18) * 2053 + index * 67 + i,
          );
          return glyphs[Math.floor(n * glyphs.length)];
        })
        .join("");
}
export function mixTextColor(base: string, color: string, amount: number) {
  return (
    "#" +
    [1, 3, 5]
      .map((index) =>
        Math.round(
          parseInt(base.slice(index, index + 2), 16) * (1 - amount) +
            parseInt(color.slice(index, index + 2), 16) * amount,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
