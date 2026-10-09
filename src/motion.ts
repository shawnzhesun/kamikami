import { z } from "zod";

export const unit = (v: number) => Math.max(0, Math.min(1, v));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const fract = (v: number) => v - Math.floor(v);
export function seeded(seed: number, index: number) {
  let n = (seed + Math.imul(index + 1, 374761393)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
const signed = (seed: number, index: number) => seeded(seed, index) * 2 - 1;
export const DepthSchema = z
  .object({
    mode: z.enum(["travel", "float"]).default("travel"),
    from: z.number().min(-0.98).max(8).default(2),
    to: z.number().min(-0.98).max(8).default(0),
    x: z.number().min(-2).max(2).default(0),
    y: z.number().min(-2).max(2).default(0),
    tiltX: z.number().min(-80).max(80).default(0),
    tiltY: z.number().min(-80).max(80).default(20),
    rotation: z.number().min(-360).max(360).default(0),
    seconds: z.number().min(0.05).max(30).default(1.5),
    easing: z.enum(["linear", "smooth", "ease-out"]).default("ease-out"),
    perspective: z.number().min(0.5).max(3).default(1),
    focus: z.number().min(-0.9).max(8).default(0),
    blur: z.number().min(0).max(40).default(8),
  })
  .strict();
export type Depth = z.infer<typeof DepthSchema>;
export function ease(t: number, mode: Depth["easing"]) {
  const u = unit(t);
  return mode === "linear"
    ? u
    : mode === "smooth"
      ? u * u * (3 - 2 * u)
      : 1 - (1 - u) ** 3;
}
/** Positive z moves away; negative z approaches. Near-plane fade prevents singularities. */
export function projectDepth(
  x: number,
  y: number,
  z: number,
  perspective = 1,
  focus = 0,
  blur = 0,
) {
  const distance = 1 + z / perspective;
  const scale = 1 / Math.max(0.15, distance);
  return {
    x: x * scale,
    y: y * scale,
    z,
    scale,
    opacity: unit((distance - 0.15) / 0.2),
    blur: Math.min(60, Math.abs(z - focus) * blur),
  };
}
export function depthFrame(
  settings: Depth,
  time: number,
  duration: number,
  amount = 1,
) {
  const t = Math.max(0, time);
  const p =
    settings.mode === "float"
      ? (1 - Math.cos((t / settings.seconds) * Math.PI * 2)) / 2
      : ease(t / Math.min(settings.seconds, duration), settings.easing);
  const a = Math.max(0, Math.min(2, amount));
  const z = mix(settings.from, settings.to, p) * a;
  return {
    ...projectDepth(
      settings.x * (1 - p) * a,
      settings.y * (1 - p) * a,
      z,
      settings.perspective,
      settings.focus,
      settings.blur * a,
    ),
    tiltX: settings.tiltX * (1 - p) * a,
    tiltY: settings.tiltY * (1 - p) * a,
    rotation: settings.rotation * (1 - p) * a,
    perspective: settings.perspective,
  };
}
export const FieldSchema = z
  .object({
    mode: z.enum(["volume", "tunnel", "orbit"]).default("volume"),
    count: z.number().int().min(2).max(48).default(12),
    spread: z.number().min(0.05).max(4).default(1.2),
    depth: z.number().min(0.1).max(8).default(3),
    size: z.number().min(0.03).max(1.5).default(0.35),
    rotation: z.number().min(0).max(180).default(20),
    faceCamera: z.boolean().default(true),
    focus: z.number().min(-0.9).max(8).default(0),
    blur: z.number().min(0).max(30).default(2),
    unit: z.enum(["whole", "word", "character"]).default("whole"),
  })
  .strict();
export type Field = z.infer<typeof FieldSchema>;
export function fieldFrames(field: Field, time: number, seed: number) {
  return Array.from({ length: field.count }, (_, i) => {
    const angle = (i / field.count) * Math.PI * 2 + time * 0.25;
    let z = seeded(seed, i * 5) * field.depth;
    let x = signed(seed, i * 5 + 1) * field.spread;
    let y = signed(seed, i * 5 + 2) * field.spread;
    if (field.mode === "tunnel") {
      // Wrap at the zero-opacity near plane so copies never pop while visible.
      z =
        fract(seeded(seed, i * 5) - time * 0.12) * (field.depth + 0.85) - 0.85;
      x = Math.cos(angle) * field.spread;
      y = Math.sin(angle) * field.spread;
    } else if (field.mode === "orbit") {
      x = Math.cos(angle) * field.spread;
      y = Math.sin(angle * 2) * field.spread * 0.35;
      z = ((1 + Math.sin(angle)) / 2) * field.depth;
    } else {
      x += Math.sin(time * 0.4 + i) * 0.12;
      y += Math.cos(time * 0.3 + i) * 0.12;
    }
    const p = projectDepth(x, y, z, 1, field.focus, field.blur);
    return {
      ...p,
      id: i,
      scale: p.scale * field.size,
      rotation: signed(seed, i * 5 + 3) * field.rotation + time * 5,
      tilt: field.faceCamera ? 0 : Math.sin(angle) * 65,
      opacity:
        p.opacity *
        (field.mode === "tunnel" ? unit((field.depth - z) / 0.4) : 1),
    };
  }).sort((a, b) => b.z - a.z);
}
export const ParticleSchema = z
  .object({
    mode: z.enum(["drift", "burst", "tunnel", "vortex"]).default("drift"),
    emitter: z.enum(["point", "box", "sphere"]).default("box"),
    shape: z.enum(["dot", "paper", "spark"]).default("dot"),
    count: z.number().int().min(4).max(256).default(80),
    lifetime: z.number().min(0.2).max(30).default(5),
    depth: z.number().min(0.1).max(8).default(3),
    velocity: z.number().min(0).max(3).default(0.3),
    gravity: z.number().min(-2).max(2).default(0.05),
    drag: z.number().min(0).max(5).default(0.2),
    turbulence: z.number().min(0).max(2).default(0.15),
    turbulenceScale: z.number().min(0.1).max(8).default(2),
    spin: z.number().min(-360).max(360).default(25),
    endSize: z.number().min(0).max(3).default(0.4),
    trails: z.number().min(0).max(1).default(0),
    focus: z.number().min(-0.9).max(8).default(0),
    blur: z.number().min(0).max(20).default(1),
    clipToSource: z.boolean().default(false),
  })
  .strict();
export type Particle = z.infer<typeof ParticleSchema>;
/** Analytic positions can be evaluated in any frame order; no playback-dependent simulation. */
export function particleFrame(
  config: Particle,
  time: number,
  seed: number,
  index: number,
) {
  const rnd = (n: number) => seeded(seed, index * 11 + n);
  const phase = config.mode === "burst" ? 0 : rnd(0) * config.lifetime;
  const age =
    fract((Math.max(0, time) + phase) / config.lifetime) * config.lifetime;
  const life = age / config.lifetime;
  const angle = rnd(1) * Math.PI * 2,
    elevation = signed(seed, index * 11 + 2);
  const radial = Math.sqrt(1 - elevation * elevation);
  const direction = [
    Math.cos(angle) * radial,
    Math.sin(angle) * radial,
    elevation,
  ];
  let x =
    config.emitter === "point"
      ? 0
      : config.emitter === "sphere"
        ? direction[0]
        : signed(seed, index * 11 + 3);
  let y =
    config.emitter === "point"
      ? 0
      : config.emitter === "sphere"
        ? direction[1]
        : signed(seed, index * 11 + 4);
  let z =
    config.emitter === "point"
      ? config.depth / 2
      : config.emitter === "sphere"
        ? ((direction[2] + 1) * config.depth) / 2
        : rnd(5) * config.depth;
  const travel =
    config.drag > 0 ? (1 - Math.exp(-config.drag * age)) / config.drag : age;
  if (config.mode === "burst") {
    x += direction[0] * travel * config.velocity;
    y += direction[1] * travel * config.velocity;
    z += direction[2] * travel * config.velocity;
  } else if (config.mode === "tunnel") z = mix(config.depth, -0.85, life);
  else if (config.mode === "vortex") {
    const a = angle + age * config.velocity;
    const r = 0.15 + rnd(3) * (1 - life);
    x = Math.cos(a) * r;
    y = Math.sin(a) * r;
    z = mix(config.depth, 0, life);
  } else {
    x += direction[0] * travel * config.velocity * 0.2;
    y -= travel * config.velocity * 0.2;
  }
  const frequency = config.turbulenceScale;
  // Shared spatial waves give neighboring particles related drift.
  x +=
    config.turbulence *
    Math.sin(y * frequency + z + age * 0.7 + seed) *
    Math.sin(age);
  y +=
    config.turbulence *
    Math.cos(x * frequency - z + age * 0.6 + seed) *
    Math.sin(age);
  y += config.gravity * age * age * 0.1;
  const p = projectDepth(x, y, z, 1, config.focus, config.blur);
  return {
    ...p,
    id: index,
    life,
    rotation: rnd(6) * 360 + age * config.spin,
    scale: p.scale * mix(1, config.endSize, life) * (0.5 + rnd(7)),
    opacity: p.opacity * unit(life * 12) * unit((1 - life) * 5),
    colorIndex: rnd(8),
  };
}
export function particleFrames(config: Particle, time: number, seed: number) {
  return Array.from({ length: config.count }, (_, i) =>
    particleFrame(config, time, seed, i),
  ).sort((a, b) => b.z - a.z);
}

/** Safe capability check before a stale service can strip new recipe fields. */
export function usesSpatialMotion(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const effect = value as {
    depth?: unknown;
    text?: {
      kind?: string;
      style?: string;
      unit?: string;
      motion?: unknown;
      glitch?: unknown;
    };
    passes?: { field?: unknown; particles?: unknown }[];
  };
  return (
    !!effect.depth ||
    !!effect.text?.motion ||
    !!effect.text?.glitch ||
    effect.text?.kind === "glitch" ||
    effect.text?.unit === "title" ||
    ["depth", "scatter", "spiral"].includes(effect.text?.style ?? "") ||
    !!effect.passes?.some((pass) => !!pass.field || !!pass.particles)
  );
}
