import { resolveEffectInstance } from "./effect-instance";
export { resolveEffectInstance } from "./effect-instance";
import { DEFAULT_FONT, fontFamilies } from "./fonts";
import {
  FontAssetSchema,
  fontIdSchema,
  fontVariant,
  resolveFont,
} from "./font-assets";
import { z } from "zod";
import { DepthSchema, bounceOut, depthFrame } from "./motion";
import { ShapeSchema, type Shape } from "./shapes";
import { BackdropSchema, type Backdrop } from "./backdrops";
import { ArtSchema, artCamera, steppedTime, type ArtUse } from "./artwork";
import {
  OverlaySchema,
  migrateProjectDecor,
  type OverlayUse,
} from "./overlays";
export { bounceOut } from "./motion";
import { TextEffectSchema, builtinTextSettings } from "./text-effects";
import { VisualPassSchema, effectRandom } from "./visual-effects";
import {
  ElementKeyframesSchema,
  InstanceKeyframesSchema,
  allTracks,
  animationTime,
  normalizeTrack,
  numberRangeAt,
  propertyAt,
  propertyRanges,
  getPath,
} from "./keyframes";
import { instanceAmountAt, resolveEffectInstanceAt } from "./effect-instance";

/** Supported project frame rates (NTSC rates as their usual decimal values). */
export const frameRates = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60] as const;
export type FrameRate = (typeof frameRates)[number];
/** Common output shapes; any even size from 256 to 4096 px is accepted. */
export const resolutionPresets = [
  { label: "1080p landscape (16:9)", width: 1920, height: 1080 },
  { label: "Vertical (9:16)", width: 1080, height: 1920 },
  { label: "Square (1:1)", width: 1080, height: 1080 },
  { label: "Portrait (4:5)", width: 1080, height: 1350 },
  { label: "720p (16:9)", width: 1280, height: 720 },
  { label: "1440p (16:9)", width: 2560, height: 1440 },
  { label: "4K UHD (16:9)", width: 3840, height: 2160 },
] as const;
/** Project capacity. Raised for transcript-driven editing (many short cuts). */
export const LIMITS = {
  elements: 500,
  tracks: 40,
  effects: 200,
  /** Effects stacked on one element. */
  elementEffects: 16,
  seconds: 3600,
  importBytes: 4 * 1024 * 1024 * 1024,
} as const;
export const ChannelSchema = z.object({
  property: z.enum([
    "x",
    "y",
    "scale",
    "rotation",
    "opacity",
    "blur",
    "brightness",
    "contrast",
    "saturation",
    "letterSpacing",
    "rotateY",
    "rotateX",
    "scaleX",
    "scaleY",
    "skewX",
  ]),
  curve: z.enum([
    "linear",
    "ease",
    "sine",
    "pulse",
    "ease-out",
    "shake",
    "steps",
    "back",
    "elastic",
    "bounce",
    "damped",
    "anticipate",
  ]),
  from: z.number().min(-2000).max(2000),
  to: z.number().min(-2000).max(2000),
  frequency: z.number().min(0).max(20),
  phase: z.number().min(-100).max(100),
  /** Optional span: the curve runs over these seconds instead of the whole clip. */
  seconds: z.number().min(0.05).max(30).optional(),
  /** With `seconds`, `end` places the span at the clip end (exits). */
  align: z.enum(["start", "end"]).optional(),
});
export const EffectSchema = z.object({
  depth: DepthSchema.optional(),
  id: z.string().max(100),
  name: z.string().max(80),
  description: z.string().max(400),
  // Keep named starting points available after a library effect is forked.
  presetFamilyId: z.string().max(100).optional(),
  channels: z.array(ChannelSchema).max(12),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  tint: z.number().min(0).max(1),
  passes: z.array(VisualPassSchema).max(6).optional(),
  text: TextEffectSchema.optional(),
  /** Artwork treatment: camera, beat or copy recipe (v8). */
  art: ArtSchema.optional(),
  /** Overlay: frames, annotations and marks drawn around the element (v8). */
  overlay: OverlaySchema.optional(),
  /** Transform pivot in canvas units (−1 left/top … 1 right/bottom), for hinged 3D moves. */
  origin: z
    .object({ x: z.number().min(-1).max(1), y: z.number().min(-1).max(1) })
    .strict()
    .optional(),
});
// Complete snapshots avoid implicit inheritance when a preset changes later.
export const EffectSettingsSchema = EffectSchema.omit({ id: true }).strict();
export type EffectSettings = z.infer<typeof EffectSettingsSchema>;
export const InstanceSchema = z.object({
  effectId: z.string(),
  amount: z.number().min(0).max(2),
  enabled: z.boolean(),
  settings: EffectSettingsSchema.optional(),
  keyframes: InstanceKeyframesSchema.optional(),
});
// `layers` and Layer remain legacy wire/API aliases for timeline elements.
export const LayerSchema = z.object({
  trackId: z.string().min(1).max(100).optional(),
  id: z.string().max(100),
  name: z.string().max(100),
  type: z.enum([
    "scene",
    "title",
    "image",
    "video",
    "audio",
    "shape",
    "backdrop",
  ]),
  src: z.string().max(500),
  text: z.string().max(2000),
  start: z.number().min(0).max(LIMITS.seconds),
  duration: z.number().min(0.1).max(LIMITS.seconds),
  offset: z.number().min(0).max(36000),
  effectOffset: z.number().min(0).max(36000),
  effectDuration: z.number().min(0).max(36000),
  muted: z.boolean(),
  solo: z.boolean(),
  // Pixels from the canvas center; bounded by the largest supported frame.
  x: z.number().min(-4096).max(4096),
  y: z.number().min(-4096).max(4096),
  scale: z.number().min(0.05).max(5),
  rotation: z.number().min(-360).max(360),
  opacity: z.number().min(0).max(1),
  volume: z.number().min(0).max(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fontSize: z.number().min(12).max(240),
  fontFamily: z.enum(fontFamilies).optional(),
  fontId: fontIdSchema.optional(),
  fontWeight: z.number().int().min(1).max(1000).optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  visible: z.boolean(),
  effects: z
    .array(InstanceSchema)
    .max(
      LIMITS.elementEffects,
      `An element can hold up to ${LIMITS.elementEffects} effects. Remove one first.`,
    ),
  keyframes: ElementKeyframesSchema.optional(),
  /** Fade from/to transparent and silent over these seconds at the clip edges. */
  fadeIn: z.number().min(0).max(30).optional(),
  fadeOut: z.number().min(0).max(30).optional(),
  /** Geometry of a shape element; its fill is `color`. */
  shape: ShapeSchema.optional(),
  /** Full-frame background or finishing overlay of a backdrop element. */
  backdrop: BackdropSchema.optional(),
});
export const TimelineLayerSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(100),
});
export type TimelineLayer = z.infer<typeof TimelineLayerSchema>;
export const ProjectSchema = z.object({
  fonts: z.array(FontAssetSchema).max(100).optional(),
  tracks: z.array(TimelineLayerSchema).max(LIMITS.tracks).optional(),
  // Version 3 is written only when keyframes, shapes or backdrops exist, so
  // older readers reject those projects instead of silently dropping data.
  version: z.union([z.literal(2), z.literal(3)]),
  name: z.string().min(1).max(100),
  width: z.number().int().min(256).max(4096).multipleOf(2),
  height: z.number().int().min(256).max(4096).multipleOf(2),
  fps: z.number().refine((v) => (frameRates as readonly number[]).includes(v), {
    message: `Frame rate must be one of ${frameRates.join(", ")}`,
  }),
  duration: z.number().min(1).max(LIMITS.seconds),
  layers: z.array(LayerSchema).max(LIMITS.elements),
  /** Integrated loudness target for exports (LUFS), or null/absent for off. */
  exportLoudness: z.number().min(-31).max(-5).nullable().optional(),
  effects: z.array(EffectSchema).max(LIMITS.effects),
});
export type Project = z.infer<typeof ProjectSchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type TimelineElement = Layer;
export type Effect = z.infer<typeof EffectSchema>;
export type Channel = z.infer<typeof ChannelSchema>;
export type EffectInstance = z.infer<typeof InstanceSchema>;
export function effectSettings(effect: Effect): EffectSettings {
  const { id: _id, ...settings } = effect;
  return EffectSettingsSchema.parse(settings);
}
/**
 * One readable sentence for a schema failure, naming the element it's on,
 * instead of the validator's JSON.
 */
function projectIssue(
  input: unknown,
  issue: { message: string; path: PropertyKey[] },
) {
  const [root, index, ...rest] = issue.path;
  const layers = (input as { layers?: { name?: unknown }[] } | null)?.layers;
  const name =
    root === "layers" && typeof index === "number"
      ? layers?.[index]?.name
      : undefined;
  const where =
    typeof name === "string" && name
      ? `“${name}”`
      : issue.path.length
        ? issue.path.join(".")
        : "";
  // Our own messages are already sentences; the validator's are not.
  const message = /^[A-Z].*\.$/.test(issue.message)
    ? issue.message
    : `${issue.message[0]?.toUpperCase() ?? ""}${issue.message.slice(1)}${rest.length ? ` (${rest.join(".")})` : ""}.`;
  return where ? `${where}: ${message}` : message;
}
export function validateProject(input: unknown): Project {
  input = migrateProjectDecor(input);
  if (
    input &&
    typeof input === "object" &&
    "version" in input &&
    input.version === 1
  )
    input = { ...input, version: 2 };
  // An older hot-running local service could strip the optional text field.
  // Recover only recognized built-in IDs; preserve all explicit/custom settings.
  if (
    input &&
    typeof input === "object" &&
    "effects" in input &&
    Array.isArray(input.effects)
  ) {
    input = {
      ...input,
      effects: input.effects.map((effect) =>
        effect &&
        typeof effect === "object" &&
        typeof effect.id === "string" &&
        effect.text === undefined &&
        Object.hasOwn(builtinTextSettings, effect.id)
          ? { ...effect, text: structuredClone(builtinTextSettings[effect.id]) }
          : effect,
      ),
    };
  }
  // Upgrade existing version-1 projects without changing their visible output.
  if (
    input &&
    typeof input === "object" &&
    "layers" in input &&
    Array.isArray(input.layers)
  ) {
    input = {
      ...input,
      layers: input.layers.map((l) =>
        l && typeof l === "object"
          ? {
              fontFamily: DEFAULT_FONT,
              effectOffset: 0,
              effectDuration: 0,
              muted: false,
              solo: false,
              ...l,
            }
          : l,
      ),
    };
  }
  const parsed = ProjectSchema.safeParse(input);
  if (!parsed.success)
    throw new Error(projectIssue(input, parsed.error.issues[0]));
  const p = parsed.data;
  const fonts = p.fonts ?? [];
  if (new Set(fonts.map((font) => font.id)).size !== fonts.length)
    throw new Error("Font IDs must be unique");
  for (const font of fonts) {
    if (
      !font.id.startsWith("custom-") ||
      font.variants.some((v) => !v.src.startsWith("/fonts/imported/"))
    )
      throw new Error("Project fonts must reference imported font assets");
  }
  if (
    new Set(p.layers.map((l) => l.id)).size !== p.layers.length ||
    new Set(p.effects.map((e) => e.id)).size !== p.effects.length
  )
    throw new Error("Layer and effect IDs must be unique");
  for (const l of p.layers) {
    if (l.fontId) {
      const font = resolveFont(l.fontId, fonts);
      if (!font) throw new Error(`Unknown font reference on “${l.name}”`);
      if (!fontVariant(font, l.fontWeight ?? 800, l.fontStyle ?? "normal"))
        throw new Error(`Unsupported weight or style for “${font.family}”`);
    }
    if (l.type === "shape" ? !l.shape : l.shape)
      throw new Error(
        l.shape
          ? `Only shape elements have shape geometry (“${l.name}”)`
          : `Shape element “${l.name}” needs shape geometry`,
      );
    if (l.type === "shape" && l.src)
      throw new Error(`Shape element “${l.name}” cannot reference media`);
    if (l.type === "backdrop" ? !l.backdrop : l.backdrop)
      throw new Error(
        l.backdrop
          ? `Only backdrop elements have backdrop settings (“${l.name}”)`
          : `Backdrop element “${l.name}” needs backdrop settings`,
      );
    if (l.type === "backdrop" && l.src)
      throw new Error(`Backdrop element “${l.name}” cannot reference media`);
    if (new Set(l.effects.map((e) => e.effectId)).size !== l.effects.length)
      throw new Error("An effect preset can only be applied once per element");
    if (l.start + l.duration > p.duration + 0.001)
      throw new Error(`“${l.name}” extends beyond the project duration`);
    if (
      l.src &&
      !/^\/media\/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp|gif|mp4|webm|mov|mp3|wav|m4a|ogg)$/i.test(
        l.src,
      )
    )
      throw new Error("Media must be imported into this workspace");
    if (l.effects.some((e) => !p.effects.some((def) => def.id === e.effectId)))
      throw new Error("Unknown effect reference");
    l.effects = l.effects.map((instance) => ({
      ...instance,
      settings:
        instance.settings ??
        effectSettings(
          p.effects.find((effect) => effect.id === instance.effectId)!,
        ),
    }));
  }
  for (const l of p.layers) validateKeyframes(l);
  // Shapes also need version 3, so older readers reject them instead of failing oddly.
  p.version = p.layers.some(
    (l) => allTracks(l).length || l.type === "shape" || l.type === "backdrop",
  )
    ? 3
    : 2;
  const tracks = p.tracks ? [...p.tracks] : [];
  if (new Set(tracks.map((t) => t.id)).size !== tracks.length)
    throw new Error("Layer IDs must be unique");
  p.layers = p.layers.map((element) => {
    if (element.trackId) {
      if (!tracks.some((t) => t.id === element.trackId))
        throw new Error("Element references an unknown layer");
      return element;
    }
    // Legacy projects and legacy element-creation commands receive their own layer.
    let id = `track-${element.id}`.slice(0, 100);
    while (tracks.some((t) => t.id === id)) id = crypto.randomUUID();
    tracks.push({ id, name: element.name.trim() || "Untitled layer" });
    return { ...element, trackId: id };
  });
  if (tracks.length > LIMITS.tracks)
    throw new Error(`The project supports up to ${LIMITS.tracks} layers`);
  p.tracks = tracks;
  for (const track of tracks) {
    const elements = p.layers
      .filter((e) => e.trackId === track.id)
      .sort((a, b) => a.start - b.start);
    for (let i = 1; i < elements.length; i++)
      if (
        elements[i].start <
        elements[i - 1].start + elements[i - 1].duration - 0.001
      )
        throw new Error(
          `Elements overlap on “${track.name}”. Choose an empty time or another layer.`,
        );
  }
  return p;
}
function validateKeyframes(l: Layer) {
  const check = (
    label: string,
    track: { value: number }[],
    range: { min: number; max: number },
  ) => {
    if (track.some((k) => k.value < range.min || k.value > range.max))
      throw new Error(
        `Keyframes for ${label} on “${l.name}” must stay between ${range.min} and ${range.max}`,
      );
  };
  if (l.keyframes) {
    for (const [property, track] of Object.entries(l.keyframes)) {
      if (!track) continue;
      if (
        property === "volume"
          ? l.type !== "audio" && l.type !== "video"
          : l.type === "audio"
      )
        throw new Error(`“${l.name}” cannot animate ${property}`);
      check(
        property,
        track,
        propertyRanges[property as keyof typeof propertyRanges],
      );
      l.keyframes[property as keyof typeof l.keyframes] = normalizeTrack(track);
    }
  }
  for (const instance of l.effects) {
    if (!instance.keyframes) continue;
    if (instance.keyframes.amount) {
      check("effect strength", instance.keyframes.amount, { min: 0, max: 2 });
      instance.keyframes.amount = normalizeTrack(instance.keyframes.amount);
    }
    for (const [path, track] of Object.entries(
      instance.keyframes.parameters ?? {},
    )) {
      const range = numberRangeAt(EffectSettingsSchema, path);
      if (!range || typeof getPath(instance.settings, path) !== "number")
        throw new Error(
          `“${path}” is not a numeric setting of ${instance.effectId} on “${l.name}”`,
        );
      check(path, track, range);
      instance.keyframes.parameters![path] = normalizeTrack(track);
    }
  }
}
export function projectTracks(project: Project): TimelineLayer[] {
  return (
    project.tracks ??
    project.layers.map((e) => ({
      id: `track-${e.id}`.slice(0, 100),
      name: e.name,
    }))
  );
}
export function elementTrackId(element: Layer) {
  return element.trackId ?? `track-${element.id}`.slice(0, 100);
}
/** Render and hit-test in layer stack order, regardless of element insertion order. */
export function orderedElements(project: Project): Layer[] {
  const order = new Map(projectTracks(project).map((t, i) => [t.id, i]));
  return [...project.layers].sort(
    (a, b) =>
      (order.get(elementTrackId(a)) ?? 0) - (order.get(elementTrackId(b)) ?? 0),
  );
}
export function channelValue(c: Channel, t: number, duration: number) {
  if (c.seconds !== undefined) {
    const span = Math.min(c.seconds, Math.max(duration, 0.001));
    if (c.align === "end") t -= duration - span;
    duration = span;
  }
  const u = Math.max(0, Math.min(1, t / Math.max(duration, 0.001)));
  let f = u;
  if (c.curve === "ease") f = u * u * (3 - 2 * u);
  if (c.curve === "ease-out") f = 1 - Math.pow(1 - u, 4);
  if (c.curve === "steps") {
    const steps = Math.max(1, Math.round(c.frequency));
    f = Math.floor(u * steps) / steps;
  }
  if (c.curve === "shake")
    f = effectRandom(
      Math.round((c.phase + 100) * 100),
      Math.floor(Math.max(0, t) * c.frequency),
    );
  // Spring curves settle exactly on `to`; overshoot is part of the motion.
  if (c.curve === "back") {
    const k = 1.70158 * (1 + Math.max(0, c.phase));
    f = 1 + (k + 1) * Math.pow(u - 1, 3) + k * Math.pow(u - 1, 2);
  }
  // Ease-in back: pulls the opposite way first, then commits (exits, throws).
  if (c.curve === "anticipate") {
    const k = 1.70158 * (1 + Math.max(0, c.phase));
    f = (k + 1) * u * u * u - k * u * u;
  }
  if (c.curve === "elastic")
    f =
      u >= 1
        ? 1
        : 1 -
          Math.pow(2, -10 * u) *
            Math.cos(2 * Math.PI * Math.max(1, c.frequency) * u);
  if (c.curve === "bounce")
    f = bounceOut(u, Math.max(1, Math.round(c.frequency)));
  if (c.curve === "damped")
    f =
      1 -
      Math.exp(-(3 + Math.max(0, c.phase)) * u) *
        Math.cos(2 * Math.PI * c.frequency * Math.max(0, t)) *
        (1 - u);
  if (c.curve === "sine")
    f = (1 - Math.cos(2 * Math.PI * (t * c.frequency + c.phase))) / 2;
  if (c.curve === "pulse")
    f = Math.pow(
      Math.max(0, Math.cos(2 * Math.PI * (t * c.frequency + c.phase))),
      12,
    );
  return c.from + (c.to - c.from) * f;
}
/** `stage` is the composition size, used to scale depth travel to the frame. */
/** Enabled artwork treatments of an element at clip-local time `t`. */
export function artUses(layer: Layer, effects: Effect[], t: number): ArtUse[] {
  const time = animationTime(layer, t);
  const uses: ArtUse[] = [];
  for (const instance of layer.effects) {
    if (!instance.enabled) continue;
    const art = resolveEffectInstanceAt(instance, effects, time)?.art;
    const amount = instanceAmountAt(instance, time);
    if (art && amount > 0) uses.push({ art, amount });
  }
  return uses;
}
/** Enabled overlays of an element at an animation time (clip-local plus effectOffset). */
export function overlayUses(
  layer: Layer,
  effects: Effect[],
  animation: number,
): OverlayUse[] {
  return layer.effects.flatMap((instance) => {
    if (!instance.enabled) return [];
    const overlay = resolveEffectInstanceAt(
      instance,
      effects,
      animation,
    )?.overlay;
    const amount = instanceAmountAt(instance, animation);
    return overlay && amount > 0 ? [{ overlay, amount }] : [];
  });
}
/**
 * Centers of the other visual elements on screen at `projectTime`, in overlay
 * units from `layer`'s center, for overlays that link elements.
 */
export function overlayPeers(
  layers: Layer[] | undefined,
  layer: Layer,
  projectTime: number,
  unitPx: number,
): [number, number][] {
  return (layers ?? []).flatMap((l) =>
    l.id !== layer.id &&
    l.visible &&
    l.type !== "audio" &&
    l.type !== "backdrop" &&
    projectTime >= l.start &&
    projectTime < l.start + l.duration
      ? [
          [(l.x - layer.x) / unitPx, (l.y - layer.y) / unitPx] as [
            number,
            number,
          ],
        ]
      : [],
  );
}
/** Clip-local time after stop-motion stutter holds it to whole steps. */
export function elementTime(layer: Layer, effects: Effect[], t: number) {
  return steppedTime(artUses(layer, effects, t), t);
}
export function layerAtTime(
  layer: Layer,
  effects: Effect[],
  clipTime: number,
  stage: { width: number; height: number } = { width: 1920, height: 1080 },
) {
  const uses = artUses(layer, effects, clipTime);
  const t = steppedTime(uses, clipTime);
  const v = {
    x: propertyAt(layer, "x", t),
    y: propertyAt(layer, "y", t),
    scale: propertyAt(layer, "scale", t),
    rotation: propertyAt(layer, "rotation", t),
    opacity: propertyAt(layer, "opacity", t),
    blur: 0,
    brightness: 1,
    contrast: 1,
    saturation: 1,
    letterSpacing: 0,
    rotateY: 0,
    rotateX: 0,
    perspective: 1800,
    scaleX: 1,
    scaleY: 1,
    skewX: 0,
    originX: 0,
    originY: 0,
    invert: 0,
  };
  const time = animationTime(layer, t);
  for (const instance of layer.effects.filter((e) => e.enabled)) {
    const definition = resolveEffectInstanceAt(instance, effects, time);
    const amount = instanceAmountAt(instance, time);
    if (definition?.origin && amount > 0) {
      v.originX = definition.origin.x;
      v.originY = definition.origin.y;
    }
    if (definition?.depth && amount > 0) {
      const d = depthFrame(
        definition.depth,
        time,
        layer.effectDuration || layer.duration,
        amount,
      );
      v.x += d.x * stage.width;
      v.y += d.y * stage.height;
      v.scale *= d.scale;
      v.rotation += d.rotation;
      v.rotateX += d.tiltX;
      v.rotateY += d.tiltY;
      v.blur += d.blur;
      v.opacity *= d.opacity;
      v.perspective = d.perspective * 1800;
    }
    for (const c of definition?.channels ?? []) {
      const value = channelValue(
        c,
        time,
        layer.effectDuration || layer.duration,
      );
      if (
        c.property === "scale" ||
        c.property === "scaleX" ||
        c.property === "scaleY" ||
        c.property === "opacity" ||
        c.property === "brightness" ||
        c.property === "contrast" ||
        c.property === "saturation"
      )
        // Clamp each factor: two negative factors must not multiply back to visible.
        v[c.property] *= Math.max(0, 1 + (value - 1) * amount);
      else v[c.property] += value * amount;
    }
  }
  if (uses.length) {
    const camera = artCamera(uses, time, layer.start + t, stage);
    v.x += camera.x;
    v.y += camera.y;
    v.scale *= camera.scale;
    v.rotation += camera.rotation;
    v.invert = camera.invert;
  }
  v.opacity = Math.max(0, Math.min(1, v.opacity * fadeGain(layer, t)));
  v.blur = Math.max(0, Math.min(100, v.blur));
  v.scale = Math.max(0.001, v.scale);
  v.brightness = Math.max(0, Math.min(10, v.brightness));
  v.contrast = Math.max(0, Math.min(10, v.contrast));
  v.saturation = Math.max(0, Math.min(10, v.saturation));
  // ±90° reaches edge-on (invisible) for page turns without showing a mirrored back.
  v.rotateY = Math.max(-90, Math.min(90, v.rotateY));
  v.rotateX = Math.max(-90, Math.min(90, v.rotateX));
  v.scaleX = Math.max(0.001, v.scaleX);
  v.scaleY = Math.max(0.001, v.scaleY);
  v.skewX = Math.max(-80, Math.min(80, v.skewX));
  return v;
}
export function makeLayer(type: Layer["type"], name: string): Layer {
  return {
    id: crypto.randomUUID(),
    name,
    type,
    src: "",
    text: "Your story starts here",
    start: 0,
    duration: 15,
    offset: 0,
    effectOffset: 0,
    effectDuration: 0,
    muted: false,
    solo: false,
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    opacity: 1,
    volume: 1,
    color: "#f1eee7",
    fontSize: 86,
    fontFamily: DEFAULT_FONT,
    visible: true,
    effects: [],
  };
}
/** A shape element filled with `color`, sized like an image's fitted box. */
export function makeShape(shape: Shape, name: string, color: string): Layer {
  return {
    ...makeLayer("shape", name),
    text: "",
    color,
    shape: structuredClone(shape),
  };
}
/** A full-frame backdrop (background or finish) element. */
export function makeBackdrop(backdrop: Backdrop, name: string): Layer {
  return {
    ...makeLayer("backdrop", name),
    text: "",
    color: backdrop.color,
    backdrop: structuredClone(backdrop),
  };
}
/** Gain of a clip's fade-in/fade-out at clip-local seconds. */
export function fadeGain(layer: Layer, localTime: number) {
  const fadeIn = Math.min(layer.fadeIn ?? 0, layer.duration / 2);
  const fadeOut = Math.min(layer.fadeOut ?? 0, layer.duration / 2);
  const t = Math.max(0, Math.min(layer.duration, localTime));
  return (
    (fadeIn > 0 ? Math.min(1, t / fadeIn) : 1) *
    (fadeOut > 0 ? Math.min(1, (layer.duration - t) / fadeOut) : 1)
  );
}
/** Automatic de-click ramp at audio edges, in seconds. */
export const AUDIO_EDGE_RAMP = 0.02;
/** True when another piece of the same source continues seamlessly at this edge (a split). */
function continues(layer: Layer, layers: Layer[], edge: "in" | "out") {
  const fps = 24;
  return layers.some(
    (o) =>
      o.id !== layer.id &&
      o.src === layer.src &&
      elementTrackId(o) === elementTrackId(layer) &&
      (edge === "in"
        ? Math.abs(o.start + o.duration - layer.start) < 0.5 / fps &&
          Math.abs(o.offset + o.duration - layer.offset) < 0.5 / fps
        : Math.abs(layer.start + layer.duration - o.start) < 0.5 / fps &&
          Math.abs(layer.offset + layer.duration - o.offset) < 0.5 / fps),
  );
}
/** `localTime` is clip-local seconds; omit it for the static (unkeyed) level. */
export function layerVolume(layer: Layer, layers: Layer[], localTime?: number) {
  const soloing = layers.some(
    (l) => l.visible && ["audio", "video"].includes(l.type) && l.solo,
  );
  if (layer.muted || (soloing && !layer.solo)) return 0;
  if (localTime === undefined) return layer.volume;
  const t = Math.max(0, Math.min(layer.duration, localTime));
  const rampIn = continues(layer, layers, "in")
    ? 1
    : Math.min(1, t / AUDIO_EDGE_RAMP);
  const rampOut = continues(layer, layers, "out")
    ? 1
    : Math.min(1, (layer.duration - t) / AUDIO_EDGE_RAMP);
  return (
    Math.max(0, Math.min(1, propertyAt(layer, "volume", localTime))) *
    fadeGain(layer, localTime) *
    Math.max(0, Math.min(rampIn, rampOut))
  );
}
/** An empty project that keeps the canvas size and frame rate of `base`. */
export function blankProject(base: Project): Project {
  return validateProject({
    version: 2,
    name: "Untitled project",
    width: base.width,
    height: base.height,
    fps: base.fps,
    duration: 15,
    tracks: [{ id: "layer-1", name: "Layer 1" }],
    layers: [],
    effects: [],
  });
}
export const initialProject: Project = validateProject({
  version: 2,
  name: "After the last train",
  width: 1920,
  height: 1080,
  fps: 24,
  duration: 15,
  effects: [
    {
      id: "slow-push",
      name: "Slow push",
      description: "A gentle, frame-accurate camera push toward the subject.",
      color: "#ff725e",
      tint: 0,
      channels: [
        {
          property: "scale",
          curve: "ease",
          from: 1,
          to: 1.12,
          frequency: 0,
          phase: 0,
        },
      ],
    },
    {
      id: "drift",
      name: "Night drift",
      description: "A quiet horizontal drift with a soft breathing glow.",
      color: "#49c4bb",
      tint: 0.08,
      channels: [
        {
          property: "x",
          curve: "sine",
          from: -15,
          to: 15,
          frequency: 0.12,
          phase: 0,
        },
        {
          property: "brightness",
          curve: "sine",
          from: 0.95,
          to: 1.12,
          frequency: 0.2,
          phase: 0,
        },
      ],
    },
    {
      id: "pulse",
      name: "Signal pulse",
      description:
        "A rhythmic light pulse. Frequency is adjustable in the effect editor.",
      color: "#ff6254",
      tint: 0.08,
      channels: [
        {
          property: "brightness",
          curve: "pulse",
          from: 1,
          to: 1.8,
          frequency: 2,
          phase: 0,
        },
      ],
    },
  ],
  layers: [
    {
      ...makeLayer("scene", "Midnight station"),
      id: "scene",
      effects: [{ effectId: "slow-push", amount: 1, enabled: true }],
    },
    {
      ...makeLayer("title", "Main title"),
      id: "title",
      text: "AFTER THE\nLAST TRAIN",
      x: -470,
      y: -60,
      fontSize: 112,
      effects: [],
    },
    {
      ...makeLayer("title", "Subtitle"),
      id: "subtitle",
      text: "A STUDY IN LIGHT, MEMORY & MOTION",
      x: -465,
      y: 130,
      fontSize: 23,
      color: "#a5c3c0",
      effects: [],
    },
  ],
});
