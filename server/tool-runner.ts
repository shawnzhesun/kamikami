import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { elementTrackId, type Project } from "../src/model";
import { AgentCommandSchema, applyAgentEdit } from "../src/agent-protocol";
import type { MediaAsset } from "../src/media";
import { toolNamed } from "./editor-tools";

/**
 * Runs one editor tool for either transport. The native assistant calls it
 * in-process; MCP reaches it through POST /api/agents/tool. Editor commands go
 * through the bridge; everything else is a local service route.
 */
export type ToolContext = {
  /** Sends a validated command to the live editor. */
  command: (action: string, args?: Record<string, unknown>) => Promise<unknown>;
  get: (route: string) => Promise<any>;
  post: (route: string, body: unknown) => Promise<any>;
  /** Copies a local file into the media library. */
  importFile: (filePath: string) => Promise<MediaAsset>;
  /**
   * Asks the user in the app. MCP has none: its client asks before
   * destructive tools, and analysis returns needsConfirmation instead.
   */
  confirm?: (question: string) => Promise<boolean>;
  by: "assistant" | "mcp";
  signal?: AbortSignal;
};
/** A PNG for the conversation, served by the local service. */
export type ToolImage = { url: string; caption: string; label: string };
export type ToolOutput = { result: unknown; image?: ToolImage };

type Snapshot = { project: Project };
const declined =
  "The user declined this action. Do not attempt it through another tool.";
/** Tools that can remove elements; the app lists what goes before running them. */
const removesElements = new Set([
  "delete_media",
  "delete_layers",
  "delete_track",
  "apply_project",
  "ripple_delete",
  "ripple_delete_clips",
  "cut_source_ranges",
  "apply_edit_list",
  "set_project_settings",
]);
const ripples = new Set([
  "ripple_delete",
  "ripple_delete_clips",
  "cut_source_ranges",
  "apply_edit_list",
]);
const query = (values: Record<string, unknown>) =>
  new URLSearchParams(
    Object.entries(values)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  ).toString();

export async function runTool(
  name: string,
  input: unknown,
  ctx: ToolContext,
): Promise<ToolOutput> {
  const definition = toolNamed(name);
  if (!definition) throw new Error("That tool is not available.");
  const args = z
    .object(definition.input)
    .strict()
    .parse(input ?? {}) as Record<string, unknown>;
  const ask = async (question: string) => {
    const accepted = await ctx.confirm!(question);
    ctx.signal?.throwIfAborted();
    return accepted;
  };
  if (ctx.confirm && removesElements.has(name))
    await confirmRemoval(name, args, ctx, ask);

  switch (name) {
    case "get_capabilities":
      return { result: await ctx.get("/api/capabilities") };
    case "find_effects":
      return { result: await ctx.post("/api/effects/find", args) };
    case "describe_effect":
      return {
        result: await ctx.get(
          "/api/effects/describe/" + encodeURIComponent(String(args.effectId)),
        ),
      };
    case "get_asset_analysis":
      return {
        result: await ctx.get(
          `/api/analysis/asset?${query({ src: args.src, section: args.section, start: args.start, end: args.end })}`,
        ),
      };
    case "search_assets":
      return {
        result: await ctx.get(
          `/api/analysis/search?${query({ q: args.query, limit: args.limit })}`,
        ),
      };
    case "set_asset_metadata":
      return {
        result: await ctx.post("/api/analysis/metadata", {
          items: args.items,
          by: ctx.by,
        }),
      };
    case "analyze_assets":
      return { result: await analyze(args, ctx, ask) };
    case "view_asset_range": {
      const view = await ctx.post("/api/analysis/view", args);
      return {
        result: view,
        image: {
          url: view.url,
          caption: `Frames and waveform for ${view.src} ${view.start.toFixed(2)}–${view.end.toFixed(2)}s`,
          label: `${view.start.toFixed(1)}–${view.end.toFixed(1)}s`,
        },
      };
    }
    case "view_timeline_range": {
      const live = (await ctx.command("get_project")) as Snapshot;
      const view = await ctx.post("/api/render-range", {
        project: live.project,
        start: args.start,
        end: args.end,
        frames: args.frames,
      });
      return {
        result: { ...view, src: "timeline" },
        image: {
          url: view.url,
          caption: `Rendered timeline ${view.start.toFixed(2)}–${view.end.toFixed(2)}s with the mixed audio`,
          label: `Timeline ${view.start.toFixed(1)}–${view.end.toFixed(1)}s`,
        },
      };
    }
    case "import_media": {
      const file = String(args.path);
      if (!path.isAbsolute(file))
        throw new Error("Give an absolute path to the file.");
      if (
        ctx.confirm &&
        !(await ask(
          `Import “${path.basename(file)}” from ${path.dirname(file)} into Media?`,
        ))
      )
        throw new Error(declined);
      const asset = await ctx.importFile(file);
      // The editor reloads its library so the new src is usable at once.
      await ctx.command("refresh_media");
      return { result: asset };
    }
    case "detach_audio": {
      // Extract the requested track, then detach it in the live editor.
      const live = (await ctx.command("get_project")) as Snapshot;
      const video = live.project.layers.find((l) => l.id === args.layerId);
      if (!video) throw new Error("Element not found. Read the project again.");
      const extracted = await ctx.post("/api/media/extract-audio", {
        src: video.src,
        track: args.track ?? 0,
      });
      await ctx.command("refresh_media");
      const { track: _track, ...rest } = args;
      return {
        result: await ctx.command("detach_audio", {
          ...rest,
          audioSrc: extracted.src,
        }),
      };
    }
    case "get_export":
      return {
        result: await ctx.get(
          "/api/export/" + encodeURIComponent(String(args.jobId)),
        ),
      };
    case "get_render":
    case "render_frame": {
      let job =
        name === "get_render"
          ? await ctx.get(
              "/api/render/" + encodeURIComponent(String(args.jobId)),
            )
          : await ctx.command(name, args);
      const deadline = Date.now() + 110_000;
      while (
        name === "render_frame" &&
        !["done", "error"].includes(job.status) &&
        Date.now() < deadline
      ) {
        await delay(700, undefined, { signal: ctx.signal });
        job = await ctx.get("/api/render/" + encodeURIComponent(job.id));
      }
      if (job.status === "error")
        throw new Error(job.error || "The render failed.");
      return {
        result: job,
        image:
          job.status === "done"
            ? {
                url: `/api/renders/${encodeURIComponent(job.id)}.png`,
                caption: `Rendered frame ${job.frame}`,
                label: `Frame ${job.frame}`,
              }
            : undefined,
      };
    }
  }
  const result = (await ctx.command(name, args)) as {
    status?: string;
    error?: string;
  };
  if (result?.status === "error")
    throw new Error(result.error || "The operation failed.");
  return { result };
}

/** Lists the elements an edit would remove and asks before running it. */
async function confirmRemoval(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
  ask: (question: string) => Promise<boolean>,
) {
  const { project } = (await ctx.command("get_project")) as Snapshot;
  const names = (keep: (l: Project["layers"][number]) => boolean) =>
    project.layers.filter((l) => !keep(l)).map((l) => l.name);
  let affected: string[] = [];
  if (name === "delete_media") affected = names((l) => l.src !== args.src);
  if (name === "delete_track")
    affected = names((l) => elementTrackId(l) !== args.trackId);
  if (name === "delete_layers")
    affected = names((l) => !(args.layerIds as string[]).includes(l.id));
  if (name === "apply_project") {
    const next = (args.project as Project).layers ?? [];
    affected = names((l) => next.some((n) => n.id === l.id));
  }
  if (name === "set_project_settings" && typeof args.duration === "number")
    affected = names((l) => l.start + l.duration <= (args.duration as number));
  // Ripple edits: simulate on the live project and list elements that vanish.
  if (ripples.has(name))
    try {
      const assets = (await ctx
        .get("/api/media")
        .catch(() => [])) as MediaAsset[];
      const preview = applyAgentEdit(
        project,
        AgentCommandSchema.parse({
          ...args,
          action: name,
          expectedRevision: "preview",
        }),
        [],
        assets,
      );
      affected = names((l) => preview.layers.some((n) => n.id === l.id));
    } catch {
      affected = [];
    }
  if (!affected.length) return;
  const verb = name === "set_project_settings" ? "Shorten or remove" : "Remove";
  const accepted = await ask(
    `${verb} ${affected.length} clip${affected.length === 1 ? "" : "s"}: ${affected.slice(0, 8).join(", ")}${affected.length > 8 ? "…" : ""}? You can undo timeline changes.`,
  );
  if (!accepted) throw new Error(declined);
  if (name === "delete_media") args.confirmUsed = true;
  if (name === "set_project_settings") args.trimAffected = true;
}

/** Model tiers upload media, so they run only after the user approves an estimate. */
async function analyze(
  args: Record<string, unknown>,
  ctx: ToolContext,
  ask: (question: string) => Promise<boolean>,
) {
  const { tier, estimate } = (await ctx.post("/api/analysis/estimate", {
    srcs: args.srcs,
    tier: args.tier,
  })) as {
    tier: string;
    estimate: {
      assets: number;
      frames: number;
      sheets: number;
      images: number;
      transcriptionMinutes: number;
      modelCalls: number;
      uploadsTo: string | null;
    };
  };
  if (tier !== "probe") {
    if (!ctx.confirm) {
      if (args.confirmed !== true)
        return {
          needsConfirmation: true,
          tier,
          estimate,
          instruction:
            "Show this estimate to the user. Call analyze_assets again with confirmed: true only after they approve uploading media.",
        };
    } else {
      const parts = [
        `${estimate.assets} asset${estimate.assets === 1 ? "" : "s"}`,
        estimate.frames
          ? `${estimate.frames} frames in ${estimate.sheets} contact sheets`
          : "",
        estimate.images ? `${estimate.images} images` : "",
        estimate.transcriptionMinutes
          ? `${estimate.transcriptionMinutes} min of audio to transcribe`
          : "",
        `about ${estimate.modelCalls} model calls`,
      ].filter(Boolean);
      if (
        !(await ask(
          `Analyze media (${tier}): ${parts.join(", ")}. Media will be sent to ${estimate.uploadsTo ?? "the connected provider"}. Continue?`,
        ))
      )
        throw new Error(
          "The user declined the analysis. Do not start it another way.",
        );
    }
  }
  return ctx.post("/api/analysis/run", {
    srcs: args.srcs,
    tier,
    prompt: args.prompt,
    confirmed: true,
    allowUpload: tier !== "probe",
  });
}

/** One readable sentence per problem instead of a raw validation dump. */
export function toolError(e: unknown) {
  if (e instanceof z.ZodError)
    return e.issues
      .slice(0, 5)
      .map((i) => (i.path.length ? `${i.path.join(".")}: ` : "") + i.message)
      .join("; ");
  return e instanceof Error ? e.message : "The tool failed.";
}
