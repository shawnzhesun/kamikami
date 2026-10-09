import { z } from "zod";
import { FieldSchema, ParticleSchema } from "./motion";

export const visualKinds = [
  "vignette",
  "spotlight",
  "bloom",
  "flare",
  "grain",
  "scanlines",
  "chromatic",
  "distortion",
  "silhouette",
  "duotone",
  "flash",
  "hatch",
  "hexagons",
  "particles",
  "wipe",
  "iris",
  "shatter",
  "echo",
  "letterbox",
  "palette",
  "smear",
  "repeat",
  "rings",
  "blinds",
] as const;
export const visualNames: Record<(typeof visualKinds)[number], string> = {
  vignette: "Vignette",
  spotlight: "Soft spotlight",
  bloom: "Highlight bloom",
  flare: "Horizontal flare",
  grain: "Film grain",
  scanlines: "CRT scanlines",
  chromatic: "RGB separation",
  distortion: "Signal distortion",
  silhouette: "Color silhouette",
  duotone: "Two-color grade",
  flash: "Light flash",
  hatch: "Diagonal hatching",
  hexagons: "Hexagon field",
  particles: "Floating flecks",
  wipe: "Panel wipe",
  iris: "Iris reveal",
  shatter: "Fragment breakup",
  echo: "Graphic echoes",
  letterbox: "Letterbox",
  palette: "Color remap",
  smear: "Motion smear",
  repeat: "Image repetition",
  rings: "Graphic rings",
  blinds: "Blinds reveal",
};
export const VisualPassSchema = z.object({
  field: FieldSchema.optional(),
  particles: ParticleSchema.optional(),
  kind: z.enum(visualKinds),
  strength: z.number().min(0).max(1),
  size: z.number().min(0).max(1),
  speed: z.number().min(0).max(10),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  angle: z.number().min(-180).max(180),
  timing: z.enum(["constant", "in", "out", "pulse"]),
  seconds: z.number().min(0.05).max(30),
  seed: z.number().int().min(0).max(65535),
  blindsDirection: z.enum(["horizontal", "vertical"]).optional(),
  paletteMode: z.enum(["negative", "solarize", "posterize"]).optional(),
  smearMode: z.enum(["zoom", "spin", "directional"]).optional(),
  repeatMode: z.enum(["grid", "mirror", "kaleidoscope", "tunnel"]).optional(),
  distortionMode: z.enum(["bands", "blocks", "wave"]).optional(),
  screenPattern: z.enum(["lines", "dots"]).optional(),
  particleStyle: z.enum(["paper", "burst"]).optional(),
  silhouetteStyle: z.enum(["fill", "outline"]).optional(),
  count: z.number().int().min(2).max(12).optional(),
});
export type VisualPass = z.infer<typeof VisualPassSchema>;
export const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
export const smooth = (n: number) => {
  const u = clamp01(n);
  return u * u * (3 - 2 * u);
};
export function effectRandom(seed: number, index: number) {
  let n = (seed + Math.imul(index + 1, 374761393)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function visualFrame(
  pass: VisualPass,
  time: number,
  duration: number,
  amount: number,
) {
  const t = Math.max(0, time);
  const period = Math.min(pass.seconds, Math.max(duration, 0.05));
  const envelope =
    pass.timing === "in"
      ? 1 - smooth(t / period)
      : pass.timing === "out"
        ? smooth((t - duration + period) / period)
        : pass.timing === "pulse"
          ? Math.pow((1 + Math.cos(t * pass.speed * Math.PI * 2)) / 2, 6)
          : 1;
  return {
    strength: clamp01(pass.strength * amount * envelope),
    time: t * pass.speed,
    tick: Math.floor(t * pass.speed * 12),
    progress: clamp01(t / Math.max(duration, 0.05)),
  };
}
