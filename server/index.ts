import { agentConventions } from "./agent-conventions";
import {
  catalogEntries,
  describeEffect,
  findEffects,
  FindEffectsSchema,
  libraryOverview,
} from "../src/effect-catalog";
import { editorTools } from "./editor-tools";
import { effectEngines } from "../src/visual-effects";
import { z } from "zod";
import { EffectLibrary } from "./effect-library";
import { EffectBundleSchema } from "../src/effect-bundle";
import { AgentCommandSchema } from "../src/agent-protocol";
import { MediaLibrary } from "./media-library";
import { AnalysisStore } from "./analysis/store";
import { AnalysisQueue } from "./analysis/queue";
import { extractAudioTrack, normalizeLoudness } from "./analysis/ffmpeg";
import { AnalysisSettingsStore } from "./analysis/settings";
import { estimate, modelStages } from "./analysis/stages";
import {
  analysisSections,
  libraryDigest,
  searchAnalyses,
  sliceAnalysis,
  type AnalysisSection,
} from "./analysis/query";
import { viewRange } from "./analysis/view";
import { providerHost, type ProviderConnection } from "./analysis/provider";
import { analysisTiers, type AnalysisTier } from "../src/asset-analysis";
import { writeMetadata } from "./analysis/metadata";
import { FontLibrary, MAX_FONT_BYTES } from "./font-library";
import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  copyFile,
  mkdir,
  readFile,
  writeFile,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { EditorBridge } from "./editor-bridge";
import { AssistantService } from "./assistant";
import { runTool, toolError } from "./tool-runner";

import { bundle } from "@remotion/bundler";
import {
  renderMedia,
  renderStill,
  selectComposition,
} from "@remotion/renderer";
import {
  validateProject,
  initialProject,
  ProjectSchema,
  EffectSchema,
  LIMITS,
  frameRates,
} from "../src/model";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = path.join(root, ".kamikami");
// Upgrade workspaces created before the KamiKami rename without rewriting their contents.
try {
  await stat(data);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  try {
    await rename(path.join(root, ".frameforge"), data);
  } catch (legacyError) {
    if ((legacyError as NodeJS.ErrnoException).code !== "ENOENT")
      throw legacyError;
  }
}
await Promise.all(
  ["media", "exports"].map((d) =>
    mkdir(path.join(data, d), { recursive: true }),
  ),
);
const library = new MediaLibrary(data);
const analysisStore = new AnalysisStore(data);
const analysisSettings = new AnalysisSettingsStore(data);
// Model stages borrow the assistant's connection lazily (it is created below).
let analysisConnection: () => ProviderConnection | null = () => null;
const analysisQueue = new AnalysisQueue(
  analysisStore,
  data,
  modelStages({
    connection: () => analysisConnection(),
    settings: () => analysisSettings.read(),
    fontFile: path.join(
      root,
      "public",
      "fonts",
      "builtin",
      "DejaVuSans-Bold.ttf",
    ),
  }),
  2,
  async (src) => (await library.list()).find((a) => a.src === src)?.name ?? src,
);
const effects = new EffectLibrary(data);
const fonts = new FontLibrary(data, path.join(root, "public"));
const app = express();
app.use((req, res, next) => {
  const host = req.headers.host ?? "";
  if (
    ![
      "127.0.0.1:4318",
      "127.0.0.1:5173",
      "localhost:4318",
      "localhost:5173",
    ].includes(host)
  )
    return res.status(403).json({ error: "Local access only" });
  const origin = req.headers.origin;
  const fontRead =
    ["GET", "HEAD"].includes(req.method) && req.path.startsWith("/fonts/");
  // Remotion renders on its own loopback origin; font files are public local assets.
  if (fontRead) res.setHeader("Access-Control-Allow-Origin", "*");
  if (
    origin &&
    !fontRead &&
    ![
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      "http://127.0.0.1:4318",
    ].includes(origin)
  )
    return res.status(403).json({ error: "Origin not allowed" });
  if (
    !["GET", "HEAD"].includes(req.method) &&
    !req.headers["x-kamikami"] &&
    !req.headers["x-frameforge"]
  )
    return res.status(403).json({ error: "Missing editor request header" });
  next();
});
app.use(express.json({ limit: "2mb" }));
app.use(
  "/fonts/builtin",
  express.static(path.join(root, "public/fonts/builtin")),
);
app.use(
  "/fonts/imported",
  express.static(path.join(data, "fonts"), {
    setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
  }),
);
const fontUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FONT_BYTES, files: 1, fields: 0 },
});
app.get("/api/fonts", async (_req, res) => res.json(await fonts.list()));
app.post("/api/fonts/import", fontUpload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Choose a font file" });
  res.json(await fonts.import(req.file.buffer, req.file.originalname));
});
app.use(
  "/media",
  express.static(path.join(data, "media"), {
    setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
  }),
);
const importable = /\.(png|jpg|jpeg|webp|gif|mp4|webm|mov|mp3|wav|m4a|ogg)$/i;
const importHint =
  "Import PNG, JPG, WebP, GIF, MP4, WebM, MOV, MP3, WAV, M4A, or OGG";
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(data, "media"),
    filename: (_req, file, cb) =>
      cb(null, randomUUID() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: LIMITS.importBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!importable.test(file.originalname)) return cb(new Error(importHint));
    cb(null, true);
  },
});
app.get("/api/health", (_req, res) =>
  res.json({
    ok: true,
    workspace: root,
    node: process.execPath,
    effectEngine: effectEngines.at(-1),
    projectVersion: 3,
    effectLibraryVersion: 2,
    elementTypes: [
      "scene",
      "title",
      "image",
      "video",
      "audio",
      "shape",
      "backdrop",
    ],
  }),
);
const bridge = new EditorBridge();
const assistant = new AssistantService(
  bridge,
  data,
  undefined,
  undefined,
  importLocalFile,
);
analysisConnection = () => assistant.analysisConnection();
await assistant.load();
await analysisQueue.load();
app.get("/api/assistant", (_req, res) => res.json(assistant.state()));
app.get("/api/assistant/models", async (_req, res) =>
  res.json(await assistant.listModels()),
);
app.post("/api/assistant/settings", (req, res) =>
  res.json(assistant.configure(req.body)),
);
app.delete("/api/assistant/settings", (_req, res) =>
  res.json(assistant.disconnect()),
);
app.post("/api/assistant/messages", (req, res) =>
  res.json(assistant.start(req.body)),
);
app.post("/api/assistant/stop", (_req, res) => res.json(assistant.stop()));
app.post("/api/assistant/confirm", (req, res) => {
  const decision = z
    .object({ id: z.string(), accepted: z.boolean() })
    .parse(req.body);
  res.json(assistant.approve(decision.id, decision.accepted));
});
app.delete("/api/assistant/messages", (_req, res) =>
  res.json(assistant.clear()),
);
app.get("/api/agents", (_req, res) =>
  res.json({ ...bridge.status(), workspace: root, node: process.execPath }),
);
app.post("/api/agents/connect", (req, res) =>
  res.json(
    bridge.connect(
      String(req.body.name ?? "MCP client"),
      String(req.body.version ?? ""),
    ),
  ),
);
app.post("/api/agents/heartbeat", (req, res) => {
  bridge.heartbeat(req.body.id);
  res.json({ ok: true });
});
app.post("/api/agents/disconnect", (req, res) => {
  bridge.disconnect(req.body.id);
  res.json({ ok: true });
});
app.post("/api/agents/command", async (req, res) =>
  res.json(await bridge.request(req.body.id, req.body.command)),
);
/** MCP tool calls run through the same dispatcher as the native assistant. */
app.post("/api/agents/tool", async (req, res) => {
  const id = String(req.body.id);
  bridge.heartbeat(id);
  const local = async (route: string, init?: RequestInit) => {
    const response = await fetch("http://127.0.0.1:4318" + route, {
      ...init,
      headers: { "Content-Type": "application/json", "X-KamiKami": "mcp" },
    });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(value.error || "KamiKami request failed");
    return value;
  };
  try {
    res.json(
      await runTool(String(req.body.name), req.body.args, {
        command: (action, args = {}) =>
          bridge.request(id, { ...args, action } as never),
        get: (route) => local(route),
        post: (route, body) =>
          local(route, { method: "POST", body: JSON.stringify(body) }),
        importFile: importLocalFile,
        by: "mcp",
      }),
    );
  } catch (e) {
    res.status(400).json({ error: toolError(e) });
  }
});
app.post("/api/editor/poll", (req, res) => {
  if (typeof req.body.editorId !== "string" || req.body.editorId.length > 100)
    throw new Error("Invalid editor session");
  res.json(bridge.poll(req.body.editorId));
});
app.post("/api/editor/reply", (req, res) =>
  res.json({
    ok: bridge.reply(
      req.body.editorId,
      req.body.id,
      req.body.result,
      req.body.error,
    ),
  }),
);
app.get("/api/project", async (_req, res) => {
  try {
    res.json(
      validateProject(
        JSON.parse(await readFile(path.join(data, "project.json"), "utf8")),
      ),
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT")
      res.json(initialProject);
    else
      res.status(500).json({
        error: "Saved project could not be read. It has not been overwritten.",
      });
  }
});
app.put("/api/project", async (req, res) => {
  try {
    const project = validateProject(req.body);
    const temp = path.join(data, `project-${randomUUID()}.tmp`);
    await writeFile(temp, JSON.stringify(project, null, 2));
    await rename(temp, path.join(data, "project.json"));
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
app.get("/api/media", async (req, res) => {
  const [assets, entries] = await Promise.all([
    library.list(req.query.includeDeleted === "true"),
    analysisStore.index(),
  ]);
  res.json(
    assets.map((a) => ({
      ...a,
      analysis: entries[a.src] ?? { status: "none" },
    })),
  );
});
app.get("/api/analysis", async (_req, res) => {
  res.json({
    entries: await analysisStore.index(),
    jobs: analysisQueue.list(),
  });
});
app.get("/api/analysis/asset", async (req, res) => {
  const src = String(req.query.src ?? "");
  const entry = await analysisStore.entry(src);
  const analysis = entry.sha256 ? await analysisStore.read(entry.sha256) : null;
  if (!analysis)
    return res
      .status(404)
      .json({ error: "This asset has not been analyzed yet." });
  const section = analysisSections.includes(
    req.query.section as AnalysisSection,
  )
    ? (req.query.section as AnalysisSection)
    : "overview";
  const start = Number(req.query.start ?? 0) || 0;
  const end = req.query.end === undefined ? Infinity : Number(req.query.end);
  res.json({
    src,
    status: entry.status,
    ...(entry.error ? { note: entry.error } : {}),
    ...sliceAnalysis(
      analysis,
      section,
      start,
      Number.isFinite(end) ? end : Infinity,
    ),
  });
});
async function analyzedLibrary() {
  const [assets, entries] = await Promise.all([
    library.list(),
    analysisStore.index(),
  ]);
  return Promise.all(
    assets
      .filter((a) => !a.missing)
      .map(async (asset) => ({
        asset,
        entry: entries[asset.src],
        analysis: entries[asset.src]?.sha256
          ? await analysisStore.read(entries[asset.src].sha256!)
          : null,
      })),
  );
}
app.get("/api/analysis/search", async (req, res) => {
  const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 10));
  res.json({
    results: searchAnalyses(
      String(req.query.q ?? ""),
      await analyzedLibrary(),
      limit,
    ),
  });
});
app.get("/api/analysis/digest", async (_req, res) => {
  const [assets, entries] = await Promise.all([
    library.list(),
    analysisStore.index(),
  ]);
  res.json({ digest: libraryDigest(assets, entries) });
});
app.post("/api/analysis/view", async (req, res) => {
  try {
    const src = String(req.body.src ?? "");
    const asset = (await library.list()).find(
      (a) => a.src === src && !a.missing,
    );
    if (!asset) return res.status(404).json({ error: "Media not found." });
    const duration =
      asset.duration ??
      (await analysisStore
        .entry(src)
        .then(async (e) =>
          e.sha256
            ? (await analysisStore.read(e.sha256))?.probe.duration
            : null,
        )) ??
      0;
    const start = Math.max(0, Number(req.body.start) || 0);
    const end = Math.min(
      duration || start + 10,
      Math.max(start + 0.05, Number(req.body.end) || start + 10),
    );
    const id = randomUUID();
    await mkdir(path.join(data, "exports", "views"), { recursive: true });
    await viewRange(
      path.join(data, src),
      asset.type,
      start,
      end,
      path.join(data, "exports", "views", `${id}.png`),
      path.join(root, "public", "fonts", "builtin", "DejaVuSans-Bold.ttf"),
      { frames: Number(req.body.frames) || 8 },
    );
    res.json({ id, url: `/api/analysis/views/${id}.png`, src, start, end });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
app.get("/api/analysis/views/:id.png", (req, res) => {
  if (!/^[a-f0-9-]+$/.test(req.params.id)) return res.sendStatus(404);
  res.sendFile(path.join(data, "exports", "views", `${req.params.id}.png`), {
    dotfiles: "allow",
  });
});
async function analysisTargets(body: { srcs?: unknown; tier?: unknown }) {
  const tier: AnalysisTier = analysisTiers.includes(body.tier as AnalysisTier)
    ? (body.tier as AnalysisTier)
    : (await analysisSettings.read()).defaultTier;
  const assets = (await library.list()).filter((a) => !a.missing);
  const chosen = Array.isArray(body.srcs)
    ? assets.filter((a) => (body.srcs as unknown[]).includes(a.src))
    : assets;
  return { tier, assets: chosen };
}
/** Extract a video's audio track as its own asset (cached per source and track). */
app.post("/api/media/extract-audio", async (req, res) => {
  try {
    const src = String(req.body.src ?? "");
    const track = Math.max(
      0,
      Math.min(31, Math.round(Number(req.body.track) || 0)),
    );
    const assets = await library.list(true);
    const source = assets.find((a) => a.src === src && !a.missing);
    if (!source || source.type !== "video")
      return res.status(404).json({ error: "Choose an imported video." });
    const stem = path.basename(src).replace(/\.[^.]+$/, "");
    const filename = `${stem}-a${track}.m4a`;
    const existing = assets.find(
      (a) => a.src === `/media/${filename}` && !a.missing,
    );
    if (existing) {
      if (existing.deleted) await library.setDeleted(existing.src, false);
      return res.json({ ...existing, deleted: false });
    }
    const output = path.join(data, "media", filename);
    await extractAudioTrack(path.join(data, src), output, track);
    const asset = await library.register(
      filename,
      `${source.name} (audio${track ? ` track ${track + 1}` : ""})`,
      (await stat(output)).size,
    );
    res.json(asset);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
app.get("/api/analysis/settings", async (_req, res) => {
  res.json(await analysisSettings.read());
});
app.put("/api/analysis/settings", async (req, res) => {
  try {
    res.json(await analysisSettings.update(req.body));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
app.post("/api/analysis/estimate", async (req, res) => {
  const { tier, assets } = await analysisTargets(req.body);
  const entries = await analysisStore.index();
  const items = await Promise.all(
    assets.map(async (a) => ({
      type: a.type,
      duration: a.duration,
      analysis: entries[a.src]?.sha256
        ? await analysisStore.read(entries[a.src].sha256!)
        : null,
    })),
  );
  res.json({
    tier,
    estimate: estimate(
      items,
      tier,
      await analysisSettings.read(),
      analysisConnection(),
    ),
  });
});
app.post("/api/analysis/run", async (req, res) => {
  const { tier, assets } = await analysisTargets(req.body);
  // Model tiers upload media, so they need an explicit confirmation of the estimate.
  if (tier !== "probe" && req.body.confirmed !== true)
    return res.status(400).json({
      error: "Confirm the analysis estimate before running model stages.",
    });
  const connection = analysisConnection();
  if (tier !== "probe" && req.body.allowUpload === true && connection)
    await analysisSettings.update({
      consent: {
        ...(await analysisSettings.read()).consent,
        [providerHost(connection)]: true,
      },
    });
  res.json({
    jobs: assets.map((a) =>
      analysisQueue.enqueue(
        a.src,
        tier,
        typeof req.body.prompt === "string" ? { prompt: req.body.prompt } : {},
      ),
    ),
  });
});
app.post("/api/analysis/metadata", async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!items?.length || items.length > 100)
    return res
      .status(400)
      .json({ error: "Send 1–100 items, each with a src and metadata." });
  const results = await writeMetadata({
    store: analysisStore,
    workspace: data,
    assets: await library.list(),
    items,
    author:
      typeof req.body.by === "string" && req.body.by.trim()
        ? req.body.by.trim().slice(0, 40)
        : "user",
  });
  const failed = results.find((r) => !r.ok);
  res.status(results.some((r) => r.ok) ? 200 : 400).json({
    results,
    ...(failed && !failed.ok ? { error: failed.error } : {}),
  });
});
app.post("/api/analysis/cancel", (req, res) => {
  analysisQueue.cancel(
    typeof req.body.id === "string" ? req.body.id : undefined,
  );
  res.json({ jobs: analysisQueue.list() });
});
app.post("/api/media/delete", async (req, res) => {
  res.json(await library.setDeleted(req.body.src, true));
});
app.post("/api/media/restore", async (req, res) => {
  res.json(await library.setDeleted(req.body.src, false));
});
app.get("/api/effects", async (_req, res) => res.json(await effects.list()));
app.post("/api/effects/import", async (req, res) =>
  res.json(await effects.import(req.body)),
);
app.post("/api/effects/save", async (req, res) =>
  res.json(await effects.save(req.body)),
);
app.post("/api/effects/delete", async (req, res) =>
  res.json(await effects.delete(req.body.effectId)),
);
// The assistant's catalog: compact search rows and one card in depth.
app.post("/api/effects/find", async (req, res) =>
  res.json(
    findEffects(
      catalogEntries(await effects.list()),
      FindEffectsSchema.parse(req.body ?? {}),
    ),
  ),
);
app.get("/api/effects/describe/:id", async (req, res) =>
  res.json(describeEffect(catalogEntries(await effects.list()), req.params.id)),
);
app.post("/api/effects/sync", async (req, res) =>
  res.json(await effects.syncProjectEffects(req.body)),
);
app.get("/api/capabilities", async (_req, res) =>
  res.json({
    version: 2,
    project: z.toJSONSchema(ProjectSchema),
    effect: z.toJSONSchema(EffectSchema),
    effectBundle: z.toJSONSchema(EffectBundleSchema),
    commands: z.toJSONSchema(AgentCommandSchema),
    limits: {
      elements: LIMITS.elements,
      layers: LIMITS.tracks,
      effectsPerProject: LIMITS.effects,
      effectsPerLayer: LIMITS.elementEffects,
      durationSeconds: LIMITS.seconds,
      importBytes: LIMITS.importBytes,
      frameRates,
    },
    effectEngine: effectEngines.at(-1),
    effectLibrary: libraryOverview(catalogEntries(await effects.list())),
    tools: editorTools.map((t) => ({ name: t.name, access: t.access })),
    conventions: agentConventions,
  }),
);
app.post("/api/media/relink", async (req, res) => {
  await library.replaceMissing(req.body.src, req.body.replacement);
  res.json({ ok: true });
});
app.put("/api/media/:filename", async (req, res) => {
  res.json(await library.update("/media/" + req.params.filename, req.body));
});
app.post("/api/import", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file supplied" });
  res.json(
    await registerImport(
      req.file.filename,
      req.file.originalname,
      req.file.size,
    ),
  );
});
async function registerImport(filename: string, name: string, size: number) {
  // Analysis runs only when the user (or an agent) asks for it.
  return library.register(filename, name, size);
}
/** import_media: copies a local file the agent named into the library. */
async function importLocalFile(filePath: string) {
  const name = path.basename(filePath);
  if (!importable.test(name)) throw new Error(importHint);
  const info = await stat(filePath).catch(() => null);
  if (!info?.isFile()) throw new Error("File not found: " + filePath);
  if (info.size > LIMITS.importBytes)
    throw new Error("Choose a file up to 4 GB.");
  const filename = randomUUID() + path.extname(name).toLowerCase();
  await copyFile(filePath, path.join(data, "media", filename));
  return registerImport(filename, name, info.size);
}
app.get("/api/exports/:id", async (req, res) => {
  if (!/^[a-f0-9-]+\.mp4$/.test(req.params.id)) return res.sendStatus(404);
  res.download(path.join(data, "exports", req.params.id), "kamikami.mp4", {
    dotfiles: "allow",
  });
});

type Job = {
  id: string;
  status: "bundling" | "rendering" | "normalizing" | "done" | "error";
  progress: number;
  error?: string;
};
const jobs = new Map<string, Job>();
let active = false;
let bundled: Promise<string> | undefined;
const renders = new Map<string, Job & { frame: number; revision: string }>();
async function getBundle() {
  bundled ??= bundle({ entryPoint: path.join(root, "src/render.tsx") }).catch(
    (e) => {
      bundled = undefined;
      throw e;
    },
  );
  return bundled;
}
/**
 * Review a timeline range as rendered output: frames plus the mixed-audio
 * waveform, for the agent's self-check after cuts (one PNG, quarter scale).
 */
app.post("/api/render-range", async (req, res) => {
  const dir = path.join(data, "exports", "views");
  const clip = path.join(dir, `${randomUUID()}.mp4`);
  try {
    const project = validateProject(req.body.project);
    await fonts.assertAvailable(project);
    const start = Math.max(0, Number(req.body.start) || 0);
    const end = Math.min(
      project.duration,
      Math.max(start + 1 / project.fps, Number(req.body.end) || start + 3),
    );
    if (end - start > 30)
      throw new Error("Review at most 30 seconds at a time.");
    const first = Math.floor(start * project.fps);
    const last = Math.max(first, Math.ceil(end * project.fps) - 1);
    await mkdir(dir, { recursive: true });
    const serveUrl = await getBundle(),
      inputProps = { project, mediaOrigin: "http://127.0.0.1:4318" };
    const composition = await selectComposition({
      serveUrl,
      id: "KamiKami",
      inputProps,
    });
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      inputProps,
      frameRange: [first, last],
      scale: Math.min(1, 640 / project.width),
      outputLocation: clip,
      concurrency: 2,
    });
    const id = randomUUID();
    await viewRange(
      clip,
      "video",
      0,
      (last - first + 1) / project.fps,
      path.join(dir, `${id}.png`),
      path.join(root, "public", "fonts", "builtin", "DejaVuSans-Bold.ttf"),
      {
        frames: Number(req.body.frames) || 8,
        labelOffset: first / project.fps,
      },
    );
    res.json({ id, url: `/api/analysis/views/${id}.png`, start, end });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  } finally {
    await rm(clip, { force: true }).catch(() => {});
  }
});
app.post("/api/render", async (req, res) => {
  const project = validateProject(req.body.project),
    frame = req.body.frame;
  await fonts.assertAvailable(project);
  if (
    !Number.isInteger(frame) ||
    frame < 0 ||
    frame >= project.duration * project.fps
  )
    throw new Error("Frame outside composition.");
  if ([...renders.values()].some((j) => j.status === "rendering"))
    return res.status(409).json({ error: "A frame is already rendering." });
  const id = randomUUID(),
    job: Job & { frame: number; revision: string } = {
      id,
      status: "rendering",
      progress: 0,
      frame,
      revision: String(req.body.revision),
    };
  renders.set(id, job);
  res.json(job);
  void (async () => {
    try {
      const serveUrl = await getBundle(),
        inputProps = { project, mediaOrigin: "http://127.0.0.1:4318" };
      const composition = await selectComposition({
        serveUrl,
        id: "KamiKami",
        inputProps,
      });
      await renderStill({
        composition,
        serveUrl,
        inputProps,
        frame,
        imageFormat: "png",
        output: path.join(data, "exports", id + ".png"),
      });
      Object.assign(job, { status: "done", progress: 1 });
    } catch (e) {
      Object.assign(job, { status: "error", error: (e as Error).message });
    }
  })();
});
app.get("/api/render/:id", (req, res) => {
  const job = renders.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Render not found" });
  res.json(job);
});
app.get("/api/renders/:id", (req, res) => {
  if (!/^[a-f0-9-]+\.png$/.test(req.params.id)) return res.sendStatus(404);
  res.sendFile(path.join(data, "exports", req.params.id), {
    dotfiles: "allow",
  });
});
app.post("/api/export", async (req, res) => {
  try {
    const project = validateProject(req.body);
    await fonts.assertAvailable(project);
    for (const l of project.layers)
      if (l.src) await stat(path.join(data, l.src));
    if (active)
      return res
        .status(409)
        .json({ error: "Another export is already running" });
    active = true;
    const id = randomUUID();
    const job: Job = { id, status: "bundling", progress: 0 };
    jobs.set(id, job);
    res.json(job);
    void (async () => {
      try {
        bundled ??= bundle({
          entryPoint: path.join(root, "src/render.tsx"),
        }).catch((e) => {
          bundled = undefined;
          throw e;
        });
        const serveUrl = await bundled,
          inputProps = { project, mediaOrigin: "http://127.0.0.1:4318" };
        const composition = await selectComposition({
          serveUrl,
          id: "KamiKami",
          inputProps,
        });
        job.status = "rendering";
        await renderMedia({
          composition,
          serveUrl,
          codec: "h264",
          inputProps,
          outputLocation: path.join(data, "exports", id + ".mp4"),
          concurrency: 2,
          onProgress: ({ progress }) => {
            job.progress = progress;
          },
        });
        // Optional loudness normalization (e.g. −14 LUFS for social platforms).
        if (
          typeof project.exportLoudness === "number" &&
          project.layers.some((l) => l.type === "audio" || l.type === "video")
        ) {
          job.status = "normalizing";
          const output = path.join(data, "exports", id + ".mp4");
          const normalized = path.join(data, "exports", id + ".norm.mp4");
          if (
            await normalizeLoudness(output, normalized, project.exportLoudness)
          )
            await rename(normalized, output);
        }
        job.status = "done";
        job.progress = 1;
      } catch (e) {
        job.status = "error";
        job.error = (e as Error).message;
      } finally {
        active = false;
      }
    })();
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
app.get("/api/export/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.sendStatus(404);
  res.json(job);
});
app.use(
  (
    error: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => res.status(400).json({ error: error.message }),
);
app.listen(4318, "127.0.0.1", () =>
  console.log("KamiKami local service: http://127.0.0.1:4318"),
);
