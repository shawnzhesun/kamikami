import {
  addTrack,
  updateTrack,
  deleteTrack,
  reorderTracks,
  moveElementsToTrack,
} from "./editor/tracks";
import { elementTrackId, projectTracks, TimelineLayerSchema } from "./model";
import { z } from "zod";
import {
  LayerSchema,
  EffectSchema,
  ProjectSchema,
  makeLayer,
  validateProject,
  type Project,
} from "./model";
import { EffectBundleSchema } from "./effect-bundle";
import { moveClips, trimClip, splitClips } from "./editor/editing";
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
    trackIds: z.array(z.string()).max(40),
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
    action: z.literal("trim_clip"),
    layerId: z.string(),
    edge: z.enum(["left", "right"]),
    position: z.number(),
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
    duration: z.number().min(1).max(600).optional(),
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
    action: z.literal("apply_effect"),
    effectId: z.string(),
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
    license: z
      .string()
      .max(200)
      .default("Unspecified; contact the author before redistribution"),
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
    action: z.literal("apply_project"),
    project: ProjectSchema,
    ...revision,
  }),
  z.object({
    action: z.literal("reorder_layers"),
    layerIds: z.array(z.string()).max(40),
    ...revision,
  }),
  z.object({
    action: z.literal("select_layers"),
    layerIds: z.array(z.string()).max(40),
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
    throw new Error("Layer not found.");
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
  if (command.action === "trim_clip") {
    const layer = project.layers.find((l) => l.id === command.layerId);
    if (!layer) throw new Error("Layer not found.");
    next = trimClip(
      project,
      layer.id,
      command.edge,
      command.position,
      assets.find((a) => a.src === layer.src)?.duration,
    );
  }
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
    next = { ...change.next, name: command.name ?? project.name };
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
      throw new Error("Layer not found. Read the project again.");
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
