import { DEFAULT_FONT, fontFamilies } from "./fonts";
import { z } from "zod";

export const ChannelSchema = z.object({
  property: z.enum([
    "x",
    "y",
    "scale",
    "rotation",
    "opacity",
    "blur",
    "brightness",
  ]),
  curve: z.enum(["linear", "ease", "sine", "pulse"]),
  from: z.number().min(-2000).max(2000),
  to: z.number().min(-2000).max(2000),
  frequency: z.number().min(0).max(20),
  phase: z.number().min(-100).max(100),
});
export const EffectSchema = z.object({
  id: z.string().max(100),
  name: z.string().max(80),
  description: z.string().max(400),
  channels: z.array(ChannelSchema).max(12),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  tint: z.number().min(0).max(1),
});
export const InstanceSchema = z.object({
  effectId: z.string(),
  amount: z.number().min(0).max(2),
  enabled: z.boolean(),
});
// `layers` and Layer remain wire/API aliases for timeline elements in version 1.
export const LayerSchema = z.object({
  trackId: z.string().min(1).max(100).optional(),
  id: z.string().max(100),
  name: z.string().max(100),
  type: z.enum(["scene", "title", "image", "video", "audio"]),
  src: z.string().max(500),
  text: z.string().max(2000),
  start: z.number().min(0).max(600),
  duration: z.number().min(0.1).max(600),
  offset: z.number().min(0).max(36000),
  effectOffset: z.number().min(0).max(36000),
  effectDuration: z.number().min(0).max(36000),
  muted: z.boolean(),
  solo: z.boolean(),
  x: z.number().min(-1920).max(1920),
  y: z.number().min(-1080).max(1080),
  scale: z.number().min(0.05).max(5),
  rotation: z.number().min(-360).max(360),
  opacity: z.number().min(0).max(1),
  volume: z.number().min(0).max(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fontSize: z.number().min(12).max(240),
  fontFamily: z.enum(fontFamilies).optional(),
  visible: z.boolean(),
  effects: z.array(InstanceSchema).max(8),
});
export const TimelineLayerSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(100),
});
export type TimelineLayer = z.infer<typeof TimelineLayerSchema>;
export const ProjectSchema = z.object({
  tracks: z.array(TimelineLayerSchema).max(40).optional(),
  version: z.literal(1),
  name: z.string().min(1).max(100),
  width: z.literal(1920),
  height: z.literal(1080),
  fps: z.literal(24),
  duration: z.number().min(1).max(600),
  layers: z.array(LayerSchema).max(40),
  effects: z.array(EffectSchema).max(40),
});
export type Project = z.infer<typeof ProjectSchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type TimelineElement = Layer;
export type Effect = z.infer<typeof EffectSchema>;
export type Channel = z.infer<typeof ChannelSchema>;
export function validateProject(input: unknown): Project {
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
  const p = ProjectSchema.parse(input);
  if (
    new Set(p.layers.map((l) => l.id)).size !== p.layers.length ||
    new Set(p.effects.map((e) => e.id)).size !== p.effects.length
  )
    throw new Error("Layer and effect IDs must be unique");
  for (const l of p.layers) {
    if (new Set(l.effects.map((e) => e.effectId)).size !== l.effects.length)
      throw new Error("An effect can only be applied once per layer");
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
  }
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
  if (tracks.length > 40)
    throw new Error("The project supports up to 40 layers");
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
  const u = Math.max(0, Math.min(1, t / Math.max(duration, 0.001)));
  let f = u;
  if (c.curve === "ease") f = u * u * (3 - 2 * u);
  if (c.curve === "sine")
    f = (1 - Math.cos(2 * Math.PI * (t * c.frequency + c.phase))) / 2;
  if (c.curve === "pulse")
    f = Math.pow(
      Math.max(0, Math.cos(2 * Math.PI * (t * c.frequency + c.phase))),
      12,
    );
  return c.from + (c.to - c.from) * f;
}
export function layerAtTime(layer: Layer, effects: Effect[], t: number) {
  const v = {
    x: layer.x,
    y: layer.y,
    scale: layer.scale,
    rotation: layer.rotation,
    opacity: layer.opacity,
    blur: 0,
    brightness: 1,
  };
  for (const instance of layer.effects.filter((e) => e.enabled)) {
    for (const c of effects.find((e) => e.id === instance.effectId)?.channels ??
      []) {
      const value = channelValue(
        c,
        t + layer.effectOffset,
        layer.effectDuration || layer.duration,
      );
      if (
        c.property === "scale" ||
        c.property === "opacity" ||
        c.property === "brightness"
      )
        v[c.property] *= 1 + (value - 1) * instance.amount;
      else v[c.property] += value * instance.amount;
    }
  }
  v.opacity = Math.max(0, Math.min(1, v.opacity));
  v.blur = Math.max(0, Math.min(100, v.blur));
  v.scale = Math.max(0.001, v.scale);
  v.brightness = Math.max(0, Math.min(10, v.brightness));
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
export function layerVolume(layer: Layer, layers: Layer[]) {
  const soloing = layers.some(
    (l) => l.visible && ["audio", "video"].includes(l.type) && l.solo,
  );
  return layer.muted || (soloing && !layer.solo) ? 0 : layer.volume;
}
export const initialProject: Project = validateProject({
  version: 1,
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
