import { z } from "zod";
const rev = {
  expectedRevision: z
    .string()
    .describe("Revision from the latest get_project or edit result."),
};
export const definitions = [
  [
    "create_track",
    "Create an empty timeline layer (track). Elements refer to it using trackId.",
    { track: z.object({ id: z.string(), name: z.string() }), ...rev },
    false,
  ],
  [
    "update_track",
    "Rename a timeline layer, preserving its elements.",
    { track: z.object({ id: z.string(), name: z.string() }), ...rev },
    false,
  ],
  [
    "delete_track",
    "Delete a timeline layer and all its elements. Review affected elements before deletion.",
    { trackId: z.string(), ...rev },
    false,
  ],
  [
    "reorder_tracks",
    "Set timeline layer stack order, bottom to top. Include every track ID exactly once, including empty tracks.",
    { trackIds: z.array(z.string()), ...rev },
    false,
  ],
  [
    "get_project",
    "Read live project, selected layer IDs, playhead, revision, editing state, and whether it is saved.",
    {},
    true,
  ],
  [
    "get_media_library",
    "List imported sources and metadata; use their src values when editing.",
    { includeDeleted: z.boolean().optional() },
    true,
  ],
  [
    "update_layer",
    "Patch one layer. Preserves other layers and records one Undo step.",
    { layerId: z.string(), patch: z.record(z.string(), z.unknown()), ...rev },
    false,
  ],
  [
    "add_text",
    "Add a text element. Supply trackId for an existing layer; omit to create a new layer.",
    {
      text: z.string().max(2000),
      trackId: z.string().optional(),
      name: z.string().max(100).optional(),
      start: z.number().optional(),
      duration: z.number().optional(),
      ...rev,
    },
    false,
  ],
  [
    "apply_project",
    "Apply a complete validated project in one Undo step, including effect definitions. Preserve unrelated IDs/content.",
    { project: z.record(z.string(), z.unknown()), ...rev },
    false,
  ],
  [
    "reorder_layers",
    "Legacy element ordering. Prefer reorder_tracks for layer stack order. Include every element ID exactly once.",
    { layerIds: z.array(z.string()), ...rev },
    false,
  ],
  [
    "select_layers",
    "Select layers in the canvas and timeline.",
    { layerIds: z.array(z.string()) },
    false,
  ],
  [
    "set_playhead",
    "Pause preview and seek to a zero-based frame within the composition.",
    { frame: z.number().int().min(0) },
    false,
  ],
  [
    "undo",
    "Undo the latest editor transaction. Read the project first; this may be a manual edit.",
    rev,
    false,
  ],
  ["redo", "Redo the latest undone editor transaction.", rev, false],
  [
    "save_project",
    "Flush the current editor snapshot to local storage.",
    {},
    false,
  ],
];
definitions.push(
  [
    "get_capabilities",
    "Get precise project/effect/bundle/command JSON schemas, limits and editing conventions. Read before authoring effects.",
    {},
    true,
  ],
  [
    "get_effect_library",
    "Read project effects and persistent user effects, including bundle IDs.",
    {},
    true,
  ],
  [
    "import_media",
    "Import a local file by absolute path into Media; returns its src. Does not add a timeline clip. Analyze next for duration/waveforms.",
    { path: z.string() },
    false,
  ],
  [
    "analyze_media",
    "Read source duration, dimensions and waveform and update the visible media library.",
    { src: z.string() },
    false,
  ],
  [
    "add_media",
    "Add an imported asset as a timeline element. Supply trackId to use an existing layer; omit to create a new layer. Duration defaults to source or five seconds; start defaults to zero.",
    {
      src: z.string(),
      trackId: z.string().optional(),
      start: z.number().optional(),
      duration: z.number().optional(),
      ...rev,
    },
    false,
  ],
  [
    "delete_media",
    "Move media to recoverable trash and remove all its clips in one Undo step. First call returns affectedLayers/requiresConfirmation when used; set confirmUsed only after user authorization.",
    { src: z.string(), confirmUsed: z.boolean().optional(), ...rev },
    false,
  ],
  [
    "restore_media",
    "Restore a source from Media trash; use Undo to restore deletion's timeline clips.",
    { src: z.string() },
    false,
  ],
  [
    "relink_media",
    "Replace all references to a missing source with an imported replacement of matching type and sufficient duration.",
    { src: z.string(), replacement: z.string(), ...rev },
    false,
  ],
  [
    "delete_layers",
    "Delete specified elements in one Undo step, retaining their tracks. layerIds are element IDs.",
    { layerIds: z.array(z.string()), ...rev },
    false,
  ],
  [
    "duplicate_layers",
    "Duplicate specified elements onto new tracks, preserving settings. layerIds are element IDs.",
    { layerIds: z.array(z.string()), ...rev },
    false,
  ],
  [
    "move_clips",
    "Move clips together by delta seconds, frame-aligned and clamped to the composition.",
    {
      layerIds: z.array(z.string()),
      delta: z.number(),
      trackId: z.string().optional(),
      ...rev,
    },
    false,
  ],
  [
    "set_keyframes",
    "Animate one element property (x, y, scale, rotation, opacity, volume) or an applied effect's strength (effectId) or numeric setting (effectId + parameter path such as passes.0.size, channels.0.to, text.distance, depth.from). Times are clip-local seconds, snapped to frames. easing (linear, ease-in, ease-out, ease-in-out, hold, bezier with bezier:[x1,y1,x2,y2]) shapes the segment leaving each keyframe. Animated values replace the static value; effects still layer on top. Pass keyframes: null to stop animating.",
    {
      layerId: z.string(),
      property: z
        .enum(["x", "y", "scale", "rotation", "opacity", "volume"])
        .optional(),
      effectId: z.string().optional(),
      parameter: z.string().optional(),
      keyframes: z
        .array(
          z.object({
            time: z.number(),
            value: z.number(),
            easing: z
              .enum([
                "linear",
                "ease-in",
                "ease-out",
                "ease-in-out",
                "hold",
                "bezier",
              ])
              .optional(),
            bezier: z.array(z.number()).length(4).optional(),
          }),
        )
        .nullable(),
      ...rev,
    },
    false,
  ],
  [
    "trim_clip",
    "Trim a clip edge to a position in composition seconds, preserving source/effect offsets.",
    {
      layerId: z.string(),
      edge: z.enum(["left", "right"]),
      position: z.number(),
      ...rev,
    },
    false,
  ],
  [
    "split_clips",
    "Split specified clips at a frame, preserving source/effect continuity.",
    { layerIds: z.array(z.string()), frame: z.number().int(), ...rev },
    false,
  ],
  [
    "set_project_settings",
    "Rename or change duration. Shortening requires trimAffected=true after reviewing affected clips with the user.",
    {
      name: z.string().optional(),
      duration: z.number().optional(),
      trimAffected: z.boolean().optional(),
      ...rev,
    },
    false,
  ],
  [
    "set_playback",
    "Play or pause the editor preview.",
    { playing: z.boolean() },
    false,
  ],
  [
    "create_effect",
    "Create a declarative effect in the live project and automatically save it to My effects. Obtain schema via get_capabilities; no executable code.",
    { effect: z.record(z.string(), z.unknown()), ...rev },
    false,
  ],
  [
    "update_effect",
    "Patch an editable My effects/project preset for future applications. Built-in and imported library originals are read-only: create_effect with a new ID to fork one. Existing instances keep their own settings; use update_effect_instance to edit those.",
    { effectId: z.string(), patch: z.record(z.string(), z.unknown()), ...rev },
    false,
  ],
  [
    "update_effect_instance",
    "Patch the settings of one applied effect on one element, without changing its preset or other instances. Patch can contain name, description, channels, passes, color, tint, or text. Get capabilities for the schema. Undoable.",
    {
      layerId: z.string(),
      effectId: z.string(),
      patch: z.record(z.string(), z.unknown()),
      ...rev,
    },
    false,
  ],
  [
    "apply_effect",
    "Apply a project or saved user effect to visual layers; copies saved definitions into the project. Existing instances remain unchanged.",
    { effectId: z.string(), layerIds: z.array(z.string()), ...rev },
    false,
  ],
  [
    "remove_effect",
    "Remove an effect instance from specified layers.",
    { effectId: z.string(), layerIds: z.array(z.string()), ...rev },
    false,
  ],
  [
    "save_user_effect",
    "Save a project effect to My effects, updating its existing entry and metadata. Library effects are copied with a new ID. Returns the saved entry and effect ID. Include author and sharing terms.",
    {
      effectId: z.string(),
      author: z.string().optional(),
      license: z.string().optional(),
      ...rev,
    },
    false,
  ],
  [
    "import_effect_bundle",
    "Validate and import a portable versioned effect bundle into the local effects library. IDs are remapped to avoid collisions.",
    { bundle: z.record(z.string(), z.unknown()) },
    false,
  ],
  [
    "export_effect_bundle",
    "Return a saved or imported effect's portable JSON bundle for sharing; userEffectId is the library entry ID.",
    { userEffectId: z.string() },
    true,
  ],
  [
    "render_frame",
    "Seek the live editor and render a PNG of that exact revision for visual inspection. Returns image content or a job ID to poll with get_render.",
    { frame: z.number().int(), ...rev },
    false,
  ],
  [
    "get_render",
    "Read a rendered frame job; returns PNG image content when complete.",
    { jobId: z.string() },
    true,
  ],
  [
    "export_video",
    "Export the live project to MP4 and show progress in the editor. Poll get_export for completion.",
    rev,
    false,
  ],
  [
    "get_export",
    "Read export progress. Completed videos are downloadable from the editor and /api/exports/<id>.mp4.",
    { jobId: z.string() },
    true,
  ],
);
