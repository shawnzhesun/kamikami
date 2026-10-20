import { z } from "zod";
import { ShapeSchema } from "../src/shapes";
import { BackdropSchema, backgroundKinds, finishKinds } from "../src/backdrops";
import { KeyframeSchema, elementKeyframeProperties } from "../src/keyframes";
import { FindEffectsSchema } from "../src/effect-catalog";
import { analysisTiers } from "../src/asset-analysis";
import { fontCategories } from "../src/font-assets";
import { analysisSections } from "./analysis/query";

/**
 * The one tool list shared by the native assistant and MCP. Enums and limits
 * come from the source schemas so descriptions never restate values that can
 * change; `get_capabilities` and the read tools report the rest.
 *
 * Terms: a track is a timeline row; an element is anything on a track (clip,
 * text, shape, backdrop). Parameters named layerId/layerIds are element IDs.
 *
 * access: "read" changes nothing, "add" only adds, "edit" may change or remove
 * existing content (reported to MCP clients as destructiveHint).
 */
export type ToolAccess = "read" | "add" | "edit";
export type ToolDefinition = {
  name: string;
  description: string;
  input: z.ZodRawShape;
  access: ToolAccess;
};

const rev = {
  expectedRevision: z
    .string()
    .describe("Revision from the latest get_project or edit result."),
};
const ids = z.array(z.string());
const track = z.object({ id: z.string(), name: z.string() });
const range = z.tuple([z.number(), z.number()]);
const placement = {
  trackId: z
    .string()
    .optional()
    .describe("An existing track; omit to create a new track."),
  start: z.number().optional().describe("Timeline seconds; default 0."),
  duration: z.number().optional(),
};
const list = (values: readonly string[]) => values.join(", ");
const tool = (
  name: string,
  access: ToolAccess,
  description: string,
  input: z.ZodRawShape = {},
): ToolDefinition => ({ name, description, input, access });

export const editorTools: ToolDefinition[] = [
  // Reading
  tool(
    "get_project",
    "read",
    "Read the live project, its revision, selected element IDs, playhead, whether the editor is busy, whether it is saved, and the user's project file (projectFile, fileSaved). Call first.",
  ),
  tool(
    "get_capabilities",
    "read",
    "Read the JSON schemas (project, effect, bundle, commands), limits, the effect library overview, and editing conventions. Read before authoring effects or patching raw fields.",
  ),
  tool(
    "get_media_library",
    "read",
    "List imported media with metadata. Use their src values when editing.",
    { includeDeleted: z.boolean().optional() },
  ),

  // Tracks
  tool(
    "create_track",
    "add",
    "Create an empty track. Elements join it with trackId.",
    { track, ...rev },
  ),
  tool("update_track", "edit", "Rename a track; its elements are kept.", {
    track,
    ...rev,
  }),
  tool("delete_track", "edit", "Delete a track and every element on it.", {
    trackId: z.string(),
    ...rev,
  }),
  tool(
    "reorder_tracks",
    "edit",
    "Set the track stack order, bottom to top. Include every track ID exactly once, empty tracks too.",
    { trackIds: ids, ...rev },
  ),

  // Elements
  tool("add_text", "add", "Add a text (title) element.", {
    text: z.string().max(2000),
    name: z.string().max(100).optional(),
    ...placement,
    ...rev,
  }),
  tool(
    "add_shape",
    "add",
    "Add a vector shape element; it takes transforms, effects and keyframes like an image. width/height are canvas pixels. color is the fill; filled:false with stroke/strokeWidth draws an outline. A thin rectangle is a line; an arrow points right, so rotate it to aim. Edit later with update_layer (patch.shape replaces the whole shape).",
    {
      shape: ShapeSchema,
      color: z.string().optional().describe("Fill color, #rrggbb."),
      name: z.string().max(100).optional(),
      ...placement,
      x: z.number().optional(),
      y: z.number().optional(),
      ...rev,
    },
  ),
  tool(
    "add_backdrop",
    "add",
    `Add a full-frame backdrop on a new track spanning the project. Backgrounds (${list(backgroundKinds)}) go on a new bottom track; finishes (${list(finishKinds)}) go on a new top track and blend over everything. color is the base or tint, secondary the pattern, accent highlights, density the pattern amount, speed 0 holds still, text is ticker text. Omitted fields take the pattern's defaults. Change it later with update_layer patch.backdrop (a complete object).`,
    {
      backdrop: BackdropSchema.partial().required({ kind: true }),
      name: z.string().max(100).optional(),
      ...rev,
    },
  ),
  tool(
    "list_fonts",
    "read",
    "List font families for text elements: built-in and imported, with fontId and the weights each style (normal, italic) supports. Set them with update_layer patch {fontId, fontWeight, fontStyle}.",
    {
      query: z.string().max(100).optional().describe("Part of a family name."),
      category: z.enum(fontCategories).optional(),
    },
  ),
  tool(
    "import_font",
    "add",
    "Import a font file (TTF, OTF, WOFF or WOFF2) by absolute path into the font library and return its fontId. Faces of one family merge into one fontId. In the app, the user approves each import.",
    { path: z.string().min(1) },
  ),
  tool(
    "update_layer",
    "edit",
    "Patch one element's fields (name, timing, transform, opacity, blend, volume, fadeIn/fadeOut, text and font fields, shape, backdrop, color, trackId). The element schema is in get_capabilities. Use the timing tools for trims and moves, and update_effect_instance for applied effects.",
    { layerId: z.string(), patch: z.record(z.string(), z.unknown()), ...rev },
  ),
  tool(
    "delete_layers",
    "edit",
    "Delete elements in one undo step; their tracks stay.",
    { layerIds: ids, ...rev },
  ),
  tool(
    "duplicate_layers",
    "add",
    "Duplicate elements onto new tracks with all their settings.",
    { layerIds: ids, ...rev },
  ),
  tool(
    "reorder_layers",
    "edit",
    "Legacy element ordering; prefer reorder_tracks. Include every element ID exactly once.",
    { layerIds: ids, ...rev },
  ),
  tool(
    "apply_project",
    "edit",
    "Replace the whole project, including effect definitions, in one undo step. Validated against the project schema. Prefer focused tools; keep unrelated IDs and content.",
    { project: z.record(z.string(), z.unknown()), ...rev },
  ),

  // Timing and editing
  tool(
    "move_clips",
    "edit",
    "Move elements together by delta seconds, frame-aligned and clamped to the project. trackId also moves them to that track.",
    {
      layerIds: ids,
      delta: z.number(),
      trackId: z.string().optional(),
      ...rev,
    },
  ),
  tool(
    "trim_clip",
    "edit",
    "Trim an element's left or right edge to a timeline position in seconds, keeping source and effect offsets.",
    {
      layerId: z.string(),
      edge: z.enum(["left", "right"]),
      position: z.number(),
      ...rev,
    },
  ),
  tool(
    "split_clips",
    "edit",
    "Split elements at a frame, keeping source and effect continuity.",
    { layerIds: ids, frame: z.number().int(), ...rev },
  ),
  tool(
    "ripple_delete",
    "edit",
    "Remove timeline ranges [start, end) in seconds and close the gaps: elements inside are removed, elements crossing an edge are trimmed or split, later ones move left. Omit trackIds to ripple every track and keep sync.",
    { ranges: z.array(range), trackIds: ids.optional(), ...rev },
  ),
  tool(
    "ripple_delete_clips",
    "edit",
    "Delete elements and close the gap on each element's track.",
    { layerIds: ids, ...rev },
  ),
  tool(
    "ripple_insert",
    "edit",
    "Open a gap of duration seconds at a timeline time, splitting elements that span it and pushing later ones right. Omit trackIds for every track.",
    {
      at: z.number(),
      duration: z.number(),
      trackIds: ids.optional(),
      ...rev,
    },
  ),
  tool(
    "cut_source_ranges",
    "edit",
    "Cut ranges given in a clip's source seconds (silences, filler words, retakes from its analysis) and close the gaps. scope all (default) ripples every track; track ripples only the clip's track.",
    {
      layerId: z.string(),
      ranges: z.array(range),
      scope: z.enum(["all", "track"]).optional(),
      ...rev,
    },
  ),
  tool(
    "apply_edit_list",
    "edit",
    "Place source ranges back to back on one track in one undo step. Each range is {src, start, end, name?} in source seconds. trackId targets an existing track (else a new one); at is the timeline start; replace clears that track first.",
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
  ),
  tool(
    "crossfade",
    "edit",
    "Crossfade two adjacent clips (to starts where from ends) by seconds, using spare source footage. The overlapping clip moves to the picture track right above when it is free, otherwise to a new Crossfades track.",
    {
      fromLayerId: z.string(),
      toLayerId: z.string(),
      seconds: z.number(),
      ...rev,
    },
  ),
  tool(
    "detach_audio",
    "edit",
    "Move a video's sound to its own audio element on a new track and mute the video (for J/L cuts or another recorded track; see the probe's audioTracks). track is the 0-based audio track, default 0.",
    { layerId: z.string(), track: z.number().int().min(0).optional(), ...rev },
  ),
  tool(
    "set_keyframes",
    "edit",
    "Animate an element property, an applied effect's strength (effectId), or a numeric effect setting (effectId plus a parameter path such as passes.0.size or overlay.size). Times are clip-local seconds, snapped to frames; easing shapes the segment leaving each key (bezier takes bezier:[x1,y1,x2,y2]). A keyed property ignores its static value. keyframes: null stops animating.",
    {
      layerId: z.string(),
      property: z.enum(elementKeyframeProperties).optional(),
      effectId: z.string().optional(),
      parameter: z.string().optional(),
      keyframes: z.array(KeyframeSchema).nullable(),
      ...rev,
    },
  ),
  tool(
    "set_project_settings",
    "edit",
    "Change the name, duration, or export loudness in LUFS (-14 social, -23 broadcast, null for off). Frame rate and size are fixed when the project is created. Shortening past elements needs trimAffected:true after the user reviews them.",
    {
      name: z.string().optional(),
      duration: z.number().optional(),
      exportLoudness: z.number().nullable().optional(),
      trimAffected: z.boolean().optional(),
      ...rev,
    },
  ),

  // Media
  tool(
    "import_media",
    "add",
    "Import a local file by absolute path into the media library and return its src. It doesn't add an element; use add_media next. In the app, the user approves each import.",
    { path: z.string() },
  ),
  tool(
    "analyze_media",
    "add",
    "Read a source's duration, dimensions and waveform into the media library.",
    { src: z.string() },
  ),
  tool(
    "add_media",
    "add",
    "Place imported media on the timeline. offset is the source second the clip starts from (video and audio). Duration defaults to the rest of the source (images: 5 s).",
    {
      src: z.string(),
      ...placement,
      offset: z.number().min(0).optional(),
      ...rev,
    },
  ),
  tool(
    "delete_media",
    "edit",
    "Move media to the recoverable trash and remove its elements in one undo step. If it's in use, the first call returns requiresConfirmation and the affected elements; pass confirmUsed only after the user agrees.",
    { src: z.string(), confirmUsed: z.boolean().optional(), ...rev },
  ),
  tool(
    "restore_media",
    "add",
    "Restore media from the trash. Undo restores the deleted elements.",
    { src: z.string() },
  ),
  tool(
    "relink_media",
    "edit",
    "Point every reference to a missing source at an imported replacement of the same type and enough duration.",
    { src: z.string(), replacement: z.string(), ...rev },
  ),

  // Media analysis
  tool(
    "get_asset_analysis",
    "read",
    "Read an asset's analysis before watching it. section: overview (default: summary, tags, probe, loudness, tempo, scenes, counts), transcript (segments), words (word timings), shots (cuts, black and frozen spans), frames (captioned samples), audio (loudness, silences, tempo with every beat time), image (description, OCR, colors, subject box, safe text region) or all. start/end are asset seconds and slice the time-based sections.",
    {
      src: z.string(),
      section: z.enum(analysisSections).optional(),
      start: z.number().optional(),
      end: z.number().optional(),
    },
  ),
  tool(
    "search_assets",
    "read",
    "Search analyzed media by keywords across names, summaries, tags, frame captions, on-screen text, scenes and transcripts. Returns matching assets with timestamped hits.",
    { query: z.string().min(1), limit: z.number().int().optional() },
  ),
  tool(
    "view_asset_range",
    "read",
    "Return one PNG of a source range: labelled frames over the waveform. Use at decision points (choosing a cut, checking a take), not to scan whole files.",
    {
      src: z.string(),
      start: z.number(),
      end: z.number(),
      frames: z.number().int().min(1).max(12).optional(),
    },
  ),
  tool(
    "view_timeline_range",
    "read",
    "Render the live timeline between start and end seconds (up to 30 s) at low resolution and return one PNG of frames over the mixed-audio waveform. Use after cuts to check continuity, pops and pacing.",
    {
      start: z.number(),
      end: z.number(),
      frames: z.number().int().min(1).max(12).optional(),
    },
  ),
  tool(
    "set_asset_metadata",
    "edit",
    "Save metadata you were given (descriptions from the user, analysis done elsewhere) without running analysis. Up to 100 items, each with an exact src. Fields: summary (one factual line for the library digest), tags, description, scenes [{start,end,title}] (video), sections [{start,end,label}] (audio/video), transcript {language?, segments [{start,end,text}], words? [{t,s,e}]} (replaces any transcript), image {caption, details, ocr, colors, subject, safeTextRegion} (merged). Times are asset seconds. Omitted fields are unchanged; clear removes fields. Saved fields are marked manual and analysis never overwrites them. Never invent details.",
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
  ),
  tool(
    "analyze_assets",
    "add",
    "Analyze media (all assets, or srcs). tier: probe (free and local: shots, loudness, silences, music tempo and beats), transcribe (only if enabled in settings), balanced (default: probe, captions, summary, plus transcription if enabled) or full. Model tiers upload media to the provider and need the user's approval of an estimate: the app asks the user; over MCP the call returns needsConfirmation until you retry with confirmed:true. prompt (e.g. lyrics) guides transcription.",
    {
      srcs: z.array(z.string()).optional(),
      tier: z.enum(analysisTiers).optional(),
      prompt: z.string().max(4000).optional(),
      confirmed: z.boolean().optional(),
    },
  ),

  // Choosing effects
  tool(
    "find_effects",
    "read",
    "Search the effects library. Returns compact rows: id, name, role, feel, what it fits (text, picture or any), a description and named variations. Filter by query words, role, feel, fits, or the elementType you'll apply it to. get_capabilities lists each role's feels. Then describe_effect a candidate.",
    FindEffectsSchema.shape,
  ),
  tool(
    "describe_effect",
    "read",
    "Describe one effect in full: role, what it fits and doesn't, its kind, every setting with its current value, range and meaning, shape variants, and each named variation as a patch. Accepts a card or variation ID.",
    { effectId: z.string() },
  ),
  tool(
    "get_effect_library",
    "read",
    "Read the full definitions of project effects, My effects and every library card. Large; prefer find_effects and describe_effect.",
  ),

  // Applying and authoring effects
  tool(
    "apply_effect",
    "add",
    "Apply a library, project or My effects effect to elements as independent instances; existing instances are unchanged. variationId applies one of the card's named variations. Refused when the effect doesn't fit the element or the element is full.",
    {
      effectId: z.string(),
      variationId: z.string().optional(),
      layerIds: ids,
      ...rev,
    },
  ),
  tool(
    "update_effect_instance",
    "edit",
    "Patch the settings of one applied effect on one element (any effect section: channels, passes, text, art, overlay, depth, origin, color, tint, name, description). Object sections merge, so {text:{tempo:120}} changes only the tempo; arrays (channels, passes) replace. The preset and other instances are unchanged. Schema in get_capabilities.",
    {
      layerId: z.string(),
      effectId: z.string(),
      patch: z.record(z.string(), z.unknown()),
      ...rev,
    },
  ),
  tool("remove_effect", "edit", "Remove an effect's instances from elements.", {
    effectId: z.string(),
    layerIds: ids,
    ...rev,
  }),
  tool(
    "create_effect",
    "add",
    "Create a declarative effect (no code) in the project and save it to My effects. Schema in get_capabilities.",
    { effect: z.record(z.string(), z.unknown()), ...rev },
  ),
  tool(
    "update_effect",
    "edit",
    "Patch an editable preset (My effects or project) for future uses; object sections merge as in update_effect_instance, and applied instances keep their settings. Library and imported originals are read-only: fork with create_effect and a new ID.",
    { effectId: z.string(), patch: z.record(z.string(), z.unknown()), ...rev },
  ),
  tool(
    "save_user_effect",
    "add",
    "Save a project effect to My effects (library effects are copied under a new ID), with an author. Set it only as the user stated it. Returns the entry and effect ID.",
    {
      effectId: z.string(),
      author: z.string().optional(),
      ...rev,
    },
  ),
  tool(
    "import_effect_bundle",
    "add",
    "Validate and import an effect file into the local library: a single-effect bundle (format frameforge-effect) or a pack of several (format kamikami-effect-pack, the effectPack schema in get_capabilities). Effect IDs are remapped; apply the returned IDs. Importing a pack whose id is already installed updates it in place.",
    { bundle: z.record(z.string(), z.unknown()) },
  ),
  tool(
    "export_effect_bundle",
    "read",
    "Return My effects or imported entries as one portable pack (.kamikami-effects.json); userEffectIds are library entry IDs. name defaults to the first effect's; set author only as the user stated it. Shared effects are free to use and share. Only when the user asks.",
    {
      userEffectIds: z.array(z.string()).min(1),
      name: z.string().optional(),
      author: z.string().optional(),
      description: z.string().optional(),
    },
  ),
  tool(
    "delete_user_effect",
    "edit",
    "Delete an entry from My effects (userEffectId is the library entry ID). Elements that use it keep their applied copies. Only when the user asks.",
    { userEffectId: z.string() },
  ),

  // Playback and history
  tool("select_layers", "add", "Select elements in the canvas and timeline.", {
    layerIds: ids,
  }),
  tool(
    "set_playhead",
    "add",
    "Pause the preview and seek to a zero-based frame.",
    { frame: z.number().int().min(0) },
  ),
  tool("set_playback", "add", "Play or pause the editor preview.", {
    playing: z.boolean(),
  }),
  tool(
    "undo",
    "edit",
    "Undo the latest editor transaction, which may be the user's. Read the project first.",
    rev,
  ),
  tool("redo", "edit", "Redo the latest undone transaction.", rev),
  tool(
    "save_project",
    "add",
    "Save the project: to the user's project file when one is open (get_project.projectFile), always to the local recovery copy. It never opens a file dialog; if projectFile is null, ask the user to press Save once to choose where.",
  ),

  // Review and export
  tool(
    "render_frame",
    "add",
    "Seek the editor and render a PNG of that exact revision. Returns the image, or a job ID to poll with get_render.",
    { frame: z.number().int(), ...rev },
  ),
  tool(
    "get_render",
    "read",
    "Read a render job; returns the PNG when it's done.",
    { jobId: z.string() },
  ),
  tool(
    "export_video",
    "add",
    "Export the project to MP4, with progress in the editor. Poll get_export.",
    rev,
  ),
  tool(
    "get_export",
    "read",
    "Read export progress. When status is done, file is the MP4's absolute path (copy it where the user wants it) and url its download link.",
    { jobId: z.string() },
  ),
];

export const toolNamed = (name: string) =>
  editorTools.find((t) => t.name === name);
