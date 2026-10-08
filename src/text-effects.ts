import { z } from "zod";
import { clamp01, effectRandom, smooth } from "./visual-effects";
import type { Effect, Layer } from "./model";

export const textEffectKinds = [
  "typewriter",
  "scramble",
  "stagger",
  "wave",
  "gradient",
  "neon",
] as const;
export const textEffectNames: Record<(typeof textEffectKinds)[number], string> =
  {
    typewriter: "Typewriter",
    scramble: "Text scramble",
    stagger: "Staggered text",
    wave: "Text wave",
    gradient: "Flowing text gradient",
    neon: "Neon text",
  };
export const TextEffectSchema = z
  .object({
    kind: z.enum(textEffectKinds),
    seconds: z.number().min(0.05).max(30).default(1.5),
    stagger: z.number().min(0).max(0.95).default(0.6),
    distance: z.number().min(0).max(3).default(0.6),
    speed: z.number().min(0).max(10).default(1),
    style: z.enum(["rise", "flip", "pop"]).default("rise"),
    unit: z.enum(["character", "word"]).default("character"),
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
};

export type ActiveTextEffect = { effect: TextEffect; amount: number };

export function activeTextEffects(
  layer: Layer,
  effects: Effect[],
): ActiveTextEffect[] {
  if (layer.type !== "title") return [];
  return layer.effects.flatMap((instance) => {
    const effect = effects.find((item) => item.id === instance.effectId)?.text;
    return effect && instance.enabled && instance.amount > 0
      ? [{ effect, amount: clamp01(instance.amount) }]
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
  const delay = count > 1 ? (index / (count - 1)) * effect.stagger : 0;
  const entry = smooth((progress - delay) / (1 - effect.stagger));
  const remaining = 1 - entry;
  let opacity = 1,
    y = 0,
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
  }
  if (effect.kind === "wave")
    y =
      Math.sin(
        time * effect.speed * Math.PI * 2 -
          index * effect.stagger * Math.PI * 2,
      ) *
      effect.distance *
      strength;
  return { opacity, y, rotateX, scale, scramble, progress };
}

const scrambleAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&";
export function scrambledText(
  original: string,
  seed: number,
  index: number,
  time: number,
  speed: number,
) {
  // Preserve whitespace and one grapheme's layout; replacements never mutate the source text.
  return /^\s+$/u.test(original)
    ? original
    : textUnits(original, "character")
        .map((_, i) => {
          const n = effectRandom(
            seed,
            Math.floor(time * speed * 18) * 2053 + index * 67 + i,
          );
          return scrambleAlphabet[Math.floor(n * scrambleAlphabet.length)];
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
