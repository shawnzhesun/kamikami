import {
  KeyframeSchema,
  elementKeyframeProperties,
  parameterPathPattern,
  setKeyframeFps,
  setTrack,
  snapTime,
  type KeyframeTarget,
} from "./keyframes";
import {
  addTrack,
  updateTrack,
  deleteTrack,
  reorderTracks,
  moveElementsToTrack,
} from "./editor/tracks";
import {
  LIMITS,
  elementTrackId,
  projectTracks,
  TimelineLayerSchema,
} from "./model";
import { z } from "zod";
import {
  LayerSchema,
  EffectSchema,
  EffectSettingsSchema,
  resolveEffectInstance,
  ProjectSchema,
  makeLayer,
  makeShape,
  makeBackdrop,
  validateProject,
  type Project,
} from "./model";
import { EffectBundleSchema } from "./effect-bundle";
import { ShapeSchema } from "./shapes";
import {
  BackdropSchema,
  backdropNames,
  isFinishKind,
  makeBackdropSettings,
} from "./backdrops";
import { addFullLengthElement } from "./editor/tracks";
import {
  moveClips,
  trimClip,
  splitClips,
  applyEditList,
  crossfade,
  cutSourceRanges,
  detachAudio,
  rippleDelete,
  rippleDeleteElements,
  rippleInsert,
} from "./editor/editing";
import { applyInstanceEffectDraft } from "./editor/effect-draft";
import { durationChange } from "./editor-utils";
import type { MediaAsset } from "./media";
const revision = { expectedRevision: z.string().min(1) };
export const AgentCommandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_track"),
    track: TimelineLayerSchema,
    ...revision,
  }),
  z.object({
    action: z.literal("update_track"),
    track: TimelineLayerSchema,
    ...revision,
  }),
  z.object({
    action: z.literal("delete_track"),
    trackId: z.string(),
    ...revision,
  }),
  z.object({
    action: z.literal("reorder_tracks"),
    trackIds: z.array(z.string()).max(LIMITS.tracks),
    ...revision,
  }),
  z.object({ action: z.literal("get_project") }),
  z.object({
    action: z.literal("get_media_library"),
    includeDeleted: z.boolean().default(false),
  }),
  z.object({ action: z.literal("get_effect_library") }),
  z.object({ action: z.literal("refresh_media") }),
  z.object({ action: z.literal("analyze_media"), src: z.string() }),
  z.object({
    action: z.literal("delete_media"),
    src: z.string(),
    confirmUsed: z.boolean().default(false),
    ...revision,
  }),
  z.object({ action: z.literal("restore_media"), src: z.string() }),
  z.object({
    action: z.literal("relink_media"),
    src: z.string(),
    replacement: z.string(),
    ...revision,
  }),
  z.object({
    action: z.literal("add_media"),
    trackId: z.string().optional(),
    src: z.string(),
    start: z.number().min(0).optional(),
    duration: z.number().min(0.1).optional(),
    ...revision,
  }),
  z.object({
    action: z.literal("delete_layers"),
    layerIds: z.array(z.string()).min(1),
    ...revision,
  }),
  z.object({
    action: z.literal("duplicate_layers"),
    layerIds: z.array(z.string()).min(1),
    ...revision,
  }),
  z.object({
    action: z.literal("move_clips"),
    trackId: z.string().optional(),
    layerIds: z.array(z.string()).min(1),
    delta: z.number(),
    ...revision,
  }),
  z.object({
    action: z.literal("set_keyframes"),
    layerId: z.string(),
    /** An element property, or an applied effect's strength / numeric setting path. */
    property: z.enum(elementKeyframeProperties).optional(),
    effectId: z.string().optional(),
    parameter: z.string().max(80).regex(parameterPathPattern).optional(),
    /** Times are clip-local seconds (0 = clip start). Empty or null removes animation. */
    keyframes: z.array(KeyframeSchema).max(240).nullable(),
    ...revision,
  }),
  z.object({
    action: z.literal("trim_clip"),
    layerId: z.string(),
    edge: z.enum(["left", "right"]),
    position: z.number(),
    ...revision,
  }),
  z.object({
    action: z.literal("ripple_delete"),
    /** Timeline ranges [start, end) in seconds; gaps close afterwards. */
    ranges: z
      .array(z.tuple([z.number(), z.number()]))
      .min(1)
      .max(2000),
    /** Omit to ripple every layer (keeps picture and sound in sync). */
    trackIds: z.array(z.string()).max(LIMITS.tracks).optional(),
    ...revision,
  }),
  z.object({
    action: z.literal("ripple_delete_clips"),
    layerIds: z.array(z.string()).min(1).max(LIMITS.elements),
    ...revision,
  }),
  z.object({
    action: z.literal("ripple_insert"),
    at: z.number().min(0),
    duration: z.number().positive().max(LIMITS.seconds),
    trackIds: z.array(z.string()).max(LIMITS.tracks).optional(),
    ...revision,
  }),
  z.object({
    action: z.literal("cut_source_ranges"),
    layerId: z.string(),
    /** Ranges in the clip's source seconds (as in its transcript/analysis). */
    ranges: z
      .array(z.tuple([z.number(), z.number()]))
      .min(1)
      .max(2000),
    scope: z.enum(["all", "track"]).default("all"),
    ...revision,
  }),
  z.object({
    action: z.literal("apply_edit_list"),
    ranges: z
      .array(
        z.object({
          src: z.string(),
          start: z.number().min(0),
          end: z.number().min(0),
          name: z.string().max(100).optional(),
        }),
      )
      .min(1)
      .max(LIMITS.elements),
    trackId: z.string().optional(),
    at: z.number().min(0).default(0),
    replace: z.boolean().default(false),
    ...revision,
  }),
  z.object({
    action: z.literal("detach_audio"),
    layerId: z.string(),
    /** Extracted audio asset (the app extracts it; agents pass layerId and track). */
    audioSrc: z.string(),
    ...revision,
  }),
  z.object({
    action: z.literal("crossfade"),
    fromLayerId: z.string(),
    toLayerId: z.string(),
    seconds: z.number().min(0.04).max(10),
    ...revision,
  }),
  z.object({
    action: z.literal("split_clips"),
    layerIds: z.array(z.string()).min(1),
    frame: z.number().int().min(0),
    ...revision,
  }),
  z.object({
    action: z.literal("set_project_settings"),
    name: z.string().min(1).max(100).optional(),
    duration: z.number().min(1).max(LIMITS.seconds).optional(),
    width: z.number().int().min(256).max(4096).optional(),
    height: z.number().int().min(256).max(4096).optional(),
    fps: z.number().optional(),
    /** Export loudness target in LUFS (e.g. −14 social, −23 broadcast), or null for off. */
    exportLoudness: z.number().min(-31).max(-5).nullable().optional(),
    trimAffected: z.boolean().default(false),
    ...revision,
  }),
  z.object({ action: z.literal("set_playback"), playing: z.boolean() }),
  z.object({
    action: z.literal("create_effect"),
    effect: EffectSchema,
    ...revision,
  }),
  z.object({
    action: z.literal("update_effect"),
    effectId: z.string(),
    patch: EffectSchema.omit({ id: true }).partial().strict(),
    ...revision,
  }),
  z.object({
    action: z.literal("update_effect_instance"),
    layerId: z.string(),
    effectId: z.string(),
    patch: EffectSettingsSchema.partial().strict(),
    ...revision,
  }),
  z.object({
    action: z.literal("apply_effect"),
    effectId: z.string(),
    /** One of the card's named variations. */
    variationId: z.string().optional(),
    layerIds: z.array(z.string()).min(1),
    ...revision,
  }),
  z.object({
    action: z.literal("remove_effect"),
    effectId: z.string(),
    layerIds: z.array(z.string()).min(1),
    ...revision,
  }),
  z.object({
    action: z.literal("save_user_effect"),
    effectId: z.string(),
    author: z.string().max(100).default(""),
    license: z.string().max(200).default("Free to use and share"),
    ...revision,
  }),
  z.object({
    action: z.literal("import_effect_bundle"),
    bundle: EffectBundleSchema,
  }),
  z.object({
    action: z.literal("export_effect_bundle"),
    userEffectId: z.string(),
  }),
  z.object({
    action: z.literal("render_frame"),
    frame: z.number().int().min(0),
    ...revision,
  }),
  z.object({ action: z.literal("export_video"), ...revision }),
  z.object({
    action: z.literal("update_layer"),
    layerId: z.string(),
    patch: LayerSchema.omit({ id: true }).partial().strict(),
    ...revision,
  }),
  z.object({
    action: z.literal("add_text"),
    trackId: z.string().optional(),
    text: z.string().max(2000),
    name: z.string().min(1).max(100).default("Agent text"),
    start: z.number().min(0).optional(),
    duration: z.number().min(0.1).optional(),
    ...revision,
  }),
  z.object({
    action: z.literal("add_shape"),
    trackId: z.string().optional(),
    shape: ShapeSchema,
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default("#f2765e"),
    name: z.string().min(1).max(100).optional(),
    start: z.number().min(0).optional(),
    duration: z.number().min(0.1).optional(),
    x: z.number().min(-4096).max(4096).optional(),
    y: z.number().min(-4096).max(4096).optional(),
    ...revision,
  }),
  z.object({
    action: z.literal("add_backdrop"),
    /** Missing fields take the pattern's defaults. */
    backdrop: BackdropSchema.partial().required({ kind: true }),
    name: z.string().min(1).max(100).optional(),
    ...revision,
  }),
  z.object({
    action: z.literal("apply_project"),
    project: ProjectSchema,
    ...revision,
  }),
  z.object({
    action: z.literal("reorder_layers"),
    layerIds: z.array(z.string()).max(LIMITS.elements),
    ...revision,
  }),
  z.object({
    action: z.literal("select_layers"),
    layerIds: z.array(z.string()).max(LIMITS.elements),
  }),
  z.object({
    action: z.literal("set_playhead"),
    frame: z.number().int().min(0),
  }),
  z.object({ action: z.literal("undo"), ...revision }),
  z.object({ action: z.literal("redo"), ...revision }),
  z.object({ action: z.literal("save_project") }),
]);
export type AgentCommand = z.infer<typeof AgentCommandSchema>;
export type EditorRequest = {
  id: string;
  clientName: string;
  command: AgentCommand;
  expiresAt: number;
  historyGroup?: string;
  nativeAssistant?: boolean;
};
export function reorderLayers(project: Project, ids: string[]): Project {
  if (
    ids.length !== project.layers.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !project.layers.some((l) => l.id === id))
  )
    throw new Error("Include every layer ID exactly once, bottom to top.");
  return {
    ...project,
    layers: ids.map((id) => project.layers.find((l) => l.id === id)!),
    tracks: [
      ...new Set([
        ...ids.map((id) =>
          elementTrackId(project.layers.find((l) => l.id === id)!),
        ),
        ...projectTracks(project).map((t) => t.id),
      ]),
    ].map((id) => projectTracks(project).find((t) => t.id === id)!),
  };
}
export function applyAgentEdit(
  project: Project,
  command: AgentCommand,
  knownSources: string[],
  assets: MediaAsset[] = [],
): Project {
  project = validateProject(project);
  setKeyframeFps(project.fps);
  let next = project;
  if (command.action === "create_track")
    next = addTrack(project, command.track);
  if (command.action === "update_track")
    next = updateTrack(project, command.track);
  if (command.action === "delete_track")
    next = deleteTrack(project, command.trackId);
  if (command.action === "reorder_tracks")
    next = reorderTracks(project, command.trackIds);
  if (
    "layerIds" in command &&
    command.layerIds.some((id) => !project.layers.some((l) => l.id === id))
  )
    throw new Error("Element not found. Read the project again.");
  if (command.action === "delete_layers")
    next = {
      ...project,
      layers: project.layers.filter((l) => !command.layerIds.includes(l.id)),
    };
  if (command.action === "duplicate_layers")
    next = {
      ...project,
      layers: project.layers.flatMap((l) =>
        command.layerIds.includes(l.id)
          ? [
              l,
              {
                ...structuredClone(l),
                trackId: undefined,
                id: crypto.randomUUID(),
                name: l.name.slice(0, 93) + " (copy)",
              },
            ]
          : [l],
      ),
    };
  if (command.action === "move_clips") {
    next = moveClips(project, command.layerIds, command.delta, false, 0, 0);
    if (command.trackId)
      next = moveElementsToTrack(
        next,
        command.layerIds,
        command.layerIds[0],
        command.trackId,
      );
  }
  if (command.action === "set_keyframes") {
    const layer = project.layers.find((l) => l.id === command.layerId);
    if (!layer) throw new Error("Element not found. Read the project again.");
    if (!!command.property === !!command.effectId)
      throw new Error("Provide either property or effectId.");
    if (command.parameter && !command.effectId)
      throw new Error("parameter requires effectId.");
    if (
      command.effectId &&
      !layer.effects.some((i) => i.effectId === command.effectId)
    )
      throw new Error("That effect is not applied to this element.");
    const target: KeyframeTarget = command.property
      ? { kind: "property", property: command.property }
      : command.parameter
        ? {
            kind: "parameter",
            effectId: command.effectId!,
            path: command.parameter,
          }
        : { kind: "amount", effectId: command.effectId! };
    // Agent times are clip-local; storage uses the trim-stable animation clock.
    const track = command.keyframes?.map((k) => ({
      ...k,
      time: snapTime(k.time + layer.effectOffset, project.fps),
    }));
    next = {
      ...project,
      layers: project.layers.map((l) =>
        l.id === layer.id ? setTrack(l, target, track) : l,
      ),
    };
  }
  if (command.action === "trim_clip") {
    const layer = project.layers.find((l) => l.id === command.layerId);
    if (!layer) throw new Error("Element not found. Read the project again.");
    next = trimClip(
      project,
      layer.id,
      command.edge,
      command.position,
      assets.find((a) => a.src === layer.src)?.duration,
    );
  }
  if (command.action === "ripple_delete")
    next = rippleDelete(project, command.ranges, command.trackIds);
  if (command.action === "ripple_delete_clips")
    next = rippleDeleteElements(project, command.layerIds);
  if (command.action === "ripple_insert")
    next = rippleInsert(
      project,
      command.at,
      command.duration,
      command.trackIds,
    );
  if (command.action === "cut_source_ranges")
    next = cutSourceRanges(
      project,
      command.layerId,
      command.ranges,
      command.scope,
    );
  if (command.action === "apply_edit_list")
    next = applyEditList(
      project,
      command.ranges,
      assets
        .filter((a) => !a.missing && !a.deleted)
        .map((a) => ({
          src: a.src,
          name: a.name,
          type: a.type,
          duration: a.duration,
        })),
      { trackId: command.trackId, at: command.at, replace: command.replace },
    ).project;
  if (command.action === "detach_audio") {
    if (!assets.some((a) => a.src === command.audioSrc && a.type === "audio"))
      throw new Error("The extracted audio is not in the media library yet.");
    next = detachAudio(project, command.layerId, command.audioSrc).project;
  }
  if (command.action === "crossfade")
    next = crossfade(
      project,
      command.fromLayerId,
      command.toLayerId,
      command.seconds,
      (src) => assets.find((a) => a.src === src)?.duration ?? null,
    );
  if (command.action === "split_clips")
    next = splitClips(project, command.layerIds, command.frame).project;
  if (command.action === "set_project_settings") {
    const change = durationChange(
      project,
      command.duration ?? project.duration,
    );
    if (change.affected.length && !command.trimAffected)
      throw new Error(
        "Shortening affects clips. Confirm trimming, then set trimAffected to true.",
      );
    next = {
      ...change.next,
      name: command.name ?? project.name,
      ...(command.width !== undefined ? { width: command.width } : {}),
      ...(command.height !== undefined ? { height: command.height } : {}),
      ...(command.fps !== undefined ? { fps: command.fps } : {}),
      ...(command.exportLoudness !== undefined
        ? { exportLoudness: command.exportLoudness }
        : {}),
    };
  }
  if (command.action === "create_effect") {
    if (project.effects.some((e) => e.id === command.effect.id))
      throw new Error("Effect ID already exists.");
    next = { ...project, effects: [...project.effects, command.effect] };
  }
  if (command.action === "update_effect") {
    if (!project.effects.some((e) => e.id === command.effectId))
      throw new Error("Effect not found.");
    next = {
      ...project,
      effects: project.effects.map((e) =>
        e.id === command.effectId ? { ...e, ...command.patch } : e,
      ),
    };
  }
  if (command.action === "update_effect_instance") {
    const instance = project.layers
      .find((layer) => layer.id === command.layerId)
      ?.effects.find((item) => item.effectId === command.effectId);
    const original =
      instance && resolveEffectInstance(instance, project.effects);
    if (!original) throw new Error("Effect instance not found.");
    next = applyInstanceEffectDraft(
      project,
      command.layerId,
      { ...original, ...command.patch },
      original,
    );
  }
  if (command.action === "remove_effect")
    next = {
      ...project,
      layers: project.layers.map((l) =>
        command.layerIds.includes(l.id)
          ? {
              ...l,
              effects: l.effects.filter((e) => e.effectId !== command.effectId),
            }
          : l,
      ),
    };
  if (command.action === "add_media") {
    const a = assets.find(
      (a) => a.src === command.src && !a.deleted && !a.missing,
    );
    if (!a) throw new Error("Available media not found.");
    const start = command.start ?? 0;
    const duration =
      command.duration ?? Math.min(a.duration ?? 5, project.duration - start);
    if (a.duration && duration > a.duration + 0.001)
      throw new Error("Clip exceeds its source duration.");
    next = {
      ...project,
      layers: [
        ...project.layers,
        {
          ...makeLayer(a.type, a.name.slice(0, 100)),
          trackId: command.trackId,
          src: a.src,
          start,
          duration,
        },
      ],
    };
  }
  if (command.action === "update_layer") {
    if (!project.layers.some((l) => l.id === command.layerId))
      throw new Error("Element not found. Read the project again.");
    next = {
      ...project,
      layers: project.layers.map((l) =>
        l.id === command.layerId ? { ...l, ...command.patch } : l,
      ),
    };
  } else if (command.action === "add_text") {
    const start = command.start ?? 0;
    next = {
      ...project,
      layers: [
        ...project.layers,
        {
          ...makeLayer("title", command.name),
          trackId: command.trackId,
          text: command.text,
          start,
          duration: command.duration ?? project.duration - start,
        },
      ],
    };
  } else if (command.action === "add_shape") {
    const start = command.start ?? 0;
    next = {
      ...project,
      layers: [
        ...project.layers,
        {
          ...makeShape(
            command.shape,
            command.name ??
              command.shape.kind[0].toUpperCase() + command.shape.kind.slice(1),
            command.color,
          ),
          trackId: command.trackId,
          start,
          duration: command.duration ?? project.duration - start,
          x: command.x ?? 0,
          y: command.y ?? 0,
        },
      ],
    };
  } else if (command.action === "add_backdrop") {
    const settings = makeBackdropSettings(
      command.backdrop.kind,
      command.backdrop,
    );
    next = addFullLengthElement(
      project,
      makeBackdrop(settings, command.name ?? backdropNames[settings.kind]),
      isFinishKind(settings.kind) ? "top" : "bottom",
    );
  } else if (command.action === "apply_project") next = command.project;
  else if (command.action === "reorder_layers")
    next = reorderLayers(project, command.layerIds);
  next = validateProject(next);
  const sources = new Set([
    ...knownSources,
    ...project.layers.map((l) => l.src),
  ]);
  if (next.layers.some((l) => l.src && !sources.has(l.src)))
    throw new Error(
      "Use an existing source from the media library. Import new files in the app first.",
    );
  return next;
}
