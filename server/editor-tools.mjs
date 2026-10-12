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
    "add_shape",
    "Add a vector shape element (treated like an image: transforms, effects, keyframes). shape.kind: rectangle (radius for rounded corners; a thin rectangle is a line), ellipse (equal width/height for a circle), polygon (sides: 3 triangle, 4 diamond, 5, 6…), star (sides = points, innerRadius 0.1–0.95), arrow (points right; rotate to aim), heart. width/height are composition pixels. color is the fill; filled:false with stroke/strokeWidth draws an outline only. Edit later with update_layer (patch.shape replaces the whole shape object; patch.color changes the fill).",
    {
      shape: z.object({
        kind: z.enum([
          "rectangle",
          "ellipse",
          "polygon",
          "star",
          "arrow",
          "heart",
        ]),
        width: z.number(),
        height: z.number(),
        filled: z.boolean().optional(),
        stroke: z.string().optional(),
        strokeWidth: z.number().optional(),
        radius: z.number().optional(),
        sides: z.number().int().optional(),
        innerRadius: z.number().optional(),
      }),
      color: z.string().optional().describe("Fill color, #rrggbb."),
      trackId: z.string().optional(),
      name: z.string().max(100).optional(),
      start: z.number().optional(),
      duration: z.number().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
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
    "get_asset_analysis",
    "Read an asset's analysis (read before watching). section: overview (default: summary, tags, probe, loudness, scenes, counts), transcript (segments), words (word timings, capped at 3000), shots (cuts plus black/frozen spans), frames (captioned samples), audio (loudness, silences), image (description, OCR, colors, subject box, safe text region), or all. start/end are asset seconds and slice time-based sections.",
    {
      src: z.string(),
      section: z
        .enum([
          "overview",
          "transcript",
          "words",
          "shots",
          "frames",
          "audio",
          "image",
          "all",
        ])
        .optional(),
      start: z.number().optional(),
      end: z.number().optional(),
    },
    true,
  ],
  [
    "search_assets",
    "Search analyzed media by keywords across names, summaries, tags, frame captions, on-screen text, scenes and transcripts. Returns matching assets with timestamped hits.",
    { query: z.string().min(1), limit: z.number().int().optional() },
    true,
  ],
  [
    "view_asset_range",
    "Render one PNG of a source range: labelled frames over a waveform. Use at decision points (choosing a cut, checking a take), never to scan whole files.",
    {
      src: z.string(),
      start: z.number(),
      end: z.number(),
      frames: z.number().int().min(1).max(12).optional(),
    },
    true,
  ],
  [
    "view_timeline_range",
    "Render the live timeline between start and end (seconds, ≤30) at low resolution and return one PNG of frames over the mixed-audio waveform. Use it after cuts to check continuity, pops and pacing.",
    {
      start: z.number(),
      end: z.number(),
      frames: z.number().int().min(1).max(12).optional(),
    },
    true,
  ],
  [
    "set_asset_metadata",
    "Write metadata to media assets without running analysis, e.g. descriptions the user gives in chat or analysis done outside the app. Batch up to 100 items; each needs an exact src from the library. Fields: summary (one factual line used in the library digest), tags, description (free-form, any asset), scenes [{start,end,title}] (video), sections [{start,end,label}] (audio/video), transcript {language?, segments [{start,end,text}], words? [{t,s,e}]} (audio/video; replaces any transcript), image {caption, details, ocr, colors, subject, safeTextRegion} (images; merged). Times are asset seconds. Omitted fields are unchanged; clear lists fields to remove. Written fields are marked manual and automatic analysis never overwrites them. Do not invent details the user did not provide or you did not see.",
    {
      items: z
        .array(
          z.object({
            src: z.string(),
            summary: z.string().max(600).optional(),
            tags: z.array(z.string().max(40)).max(20).optional(),
            description: z.string().max(4000).optional(),
            scenes: z
              .array(
                z.object({
                  start: z.number(),
                  end: z.number(),
                  title: z.string(),
                }),
              )
              .optional(),
            sections: z
              .array(
                z.object({
                  start: z.number(),
                  end: z.number(),
                  label: z.string(),
                }),
              )
              .optional(),
            transcript: z
              .object({
                language: z.string().optional(),
                segments: z.array(
                  z.object({
                    start: z.number(),
                    end: z.number(),
                    text: z.string(),
                  }),
                ),
                words: z
                  .array(
                    z.object({ t: z.string(), s: z.number(), e: z.number() }),
                  )
                  .optional(),
              })
              .optional(),
            image: z
              .object({
                caption: z.string().optional(),
                details: z.string().optional(),
                ocr: z.array(z.string()).optional(),
                colors: z.array(z.string()).optional(),
                subject: z
                  .tuple([z.number(), z.number(), z.number(), z.number()])
                  .nullable()
                  .optional(),
                safeTextRegion: z
                  .enum(["top", "bottom", "left", "right", "center", "none"])
                  .optional(),
              })
              .optional(),
            clear: z
              .array(
                z.enum([
                  "summary",
                  "description",
                  "scenes",
                  "sections",
                  "transcript",
                  "image",
                ]),
              )
              .optional(),
          }),
        )
        .min(1)
        .max(100),
    },
    false,
  ],
  [
    "analyze_assets",
    "Analyze media (all assets, or srcs). tier: probe (free, local: shots, loudness, silences), transcribe (opt-in in settings), balanced (default: probe, captions, summary, and transcription only if enabled) or full. Model tiers upload media to the connected provider and require the user's approval of a cost estimate; the app asks them. Pass prompt (e.g. lyrics) to guide transcription.",
    {
      srcs: z.array(z.string()).optional(),
      tier: z.enum(["probe", "transcribe", "balanced", "full"]).optional(),
      prompt: z.string().max(4000).optional(),
      confirmed: z.boolean().optional(),
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
    "ripple_delete",
    "Remove timeline ranges [start, end) (seconds) and close the gaps: clips inside are removed, clips crossing an edge are trimmed or split, everything after moves left. Omit trackIds to ripple all layers and keep sync.",
    {
      ranges: z.array(z.tuple([z.number(), z.number()])),
      trackIds: z.array(z.string()).optional(),
      ...rev,
    },
    false,
  ],
  [
    "ripple_delete_clips",
    "Delete clips and close the gap on each clip's own layer.",
    { layerIds: z.array(z.string()), ...rev },
    false,
  ],
  [
    "ripple_insert",
    "Open a gap of duration seconds at a timeline time, splitting clips that span it and pushing later clips right.",
    {
      at: z.number(),
      duration: z.number(),
      trackIds: z.array(z.string()).optional(),
      ...rev,
    },
    false,
  ],
  [
    "cut_source_ranges",
    "Cut ranges given in a clip's source seconds (from its analysis: silences, filler words, retakes) and close the gaps. scope all (default) ripples every layer; track only that clip's layer.",
    {
      layerId: z.string(),
      ranges: z.array(z.tuple([z.number(), z.number()])),
      scope: z.enum(["all", "track"]).optional(),
      ...rev,
    },
    false,
  ],
  [
    "apply_edit_list",
    "Assemble source ranges back to back on one layer in a single undo step (an edit decision list). Each range is {src, start, end, name?} in source seconds; cut on word/silence boundaries from the analysis. trackId targets an existing layer (else a new one); at is the timeline start; replace clears that layer first.",
    {
      ranges: z.array(
        z.object({
          src: z.string(),
          start: z.number(),
          end: z.number(),
          name: z.string().optional(),
        }),
      ),
      trackId: z.string().optional(),
      at: z.number().optional(),
      replace: z.boolean().optional(),
      ...rev,
    },
    false,
  ],
  [
    "detach_audio",
    "Detach a video's sound into its own audio element on a separate layer (for J/L cuts, separate audio edits, or choosing another recorded audio track; see the asset probe's audioTracks). The video is muted. track is the 0-based audio track (default 0).",
    { layerId: z.string(), track: z.number().int().min(0).optional(), ...rev },
    false,
  ],
  [
    "crossfade",
    "Crossfade two adjacent clips (to starts where from ends) by seconds, using spare source footage; the overlapping clip moves to a free layer.",
    {
      fromLayerId: z.string(),
      toLayerId: z.string(),
      seconds: z.number(),
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
    "Rename, change duration, output size (width/height, e.g. 1080x1920 vertical), frame rate (23.976, 24, 25, 29.97, 30, 50, 59.94, 60) or export loudness (LUFS target such as -14 for social, -23 broadcast; null for off). Shortening requires trimAffected=true after reviewing affected clips with the user.",
    {
      name: z.string().optional(),
      duration: z.number().optional(),
      width: z.number().int().optional(),
      height: z.number().int().optional(),
      fps: z.number().optional(),
      exportLoudness: z.number().nullable().optional(),
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
