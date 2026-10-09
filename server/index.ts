import { z } from "zod";
import { EffectLibrary } from "./effect-library";
import { EffectBundleSchema } from "../src/effect-bundle";
import { AgentCommandSchema } from "../src/agent-protocol";
import { MediaLibrary } from "./media-library";
import { FontLibrary, MAX_FONT_BYTES } from "./font-library";
import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, writeFile, rename, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { EditorBridge } from "./editor-bridge";
import { AssistantService } from "./assistant";

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
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(data, "media"),
    filename: (_req, file, cb) =>
      cb(null, randomUUID() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 500 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (
      !/\.(png|jpg|jpeg|webp|gif|mp4|webm|mov|mp3|wav|m4a|ogg)$/i.test(
        file.originalname,
      )
    )
      return cb(
        new Error(
          "Import PNG, JPG, WebP, GIF, MP4, WebM, MOV, MP3, WAV, M4A, or OGG",
        ),
      );
    cb(null, true);
  },
});
app.get("/api/health", (_req, res) =>
  res.json({
    ok: true,
    workspace: root,
    node: process.execPath,
    effectEngine: "kamikami-visual-v7",
    projectVersion: 3,
    effectLibraryVersion: 2,
  }),
);
const bridge = new EditorBridge();
const assistant = new AssistantService(bridge, data);
await assistant.load();
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
  res.json(await library.list(req.query.includeDeleted === "true"));
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
app.post("/api/effects/sync", async (req, res) =>
  res.json(await effects.syncProjectEffects(req.body)),
);
app.get("/api/capabilities", (_req, res) =>
  res.json({
    version: 1,
    project: z.toJSONSchema(ProjectSchema),
    effect: z.toJSONSchema(EffectSchema),
    effectBundle: z.toJSONSchema(EffectBundleSchema),
    commands: z.toJSONSchema(AgentCommandSchema),
    limits: {
      layers: 40,
      effectsPerProject: 40,
      effectsPerLayer: 8,
      durationSeconds: 600,
      importBytes: 500 * 1024 * 1024,
    },
    conventions:
      "Project version 2 stores complete independent settings on each applied effect instance; version 3 is written when keyframes exist. Keyframes: element.keyframes.{x,y,scale,rotation,opacity,volume} and instance.keyframes.{amount,parameters[numeric settings path]} are arrays of {time,value,easing,bezier?}; times are animation seconds (clip-local time + effectOffset); easing (linear/ease-in/ease-out/ease-in-out/hold/bezier) shapes the segment leaving a key; an animated value replaces the static one and effects still layer on top. Prefer set_keyframes, which takes clip-local times. version-1 projects migrate with their current appearance preserved. update_effect_instance changes one element; update_effect changes only a preset for future uses. tracks are independent timeline layers ordered bottom to top; layers is the legacy JSON array of elements, each referencing a trackId. Same-track elements cannot overlap; seconds for clip times; x/y from canvas center; source offsets and effect offsets preserve trim continuity. Frequency is cycles per second and phase is cycles. Channels add x/y/rotation/blur/letterSpacing/rotateX/rotateY/skewX and multiply scale/scaleX/scaleY/opacity/brightness/contrast/saturation. Curves include linear/ease/ease-out/sine/pulse/shake/steps plus spring back/anticipate (phase = extra overshoot), elastic (frequency = oscillations), bounce (frequency = bounces) and damped (frequency Hz, phase = extra damping); shake frequency is held samples per second, steps frequency is the number of steps. Optional channel seconds runs the curve over that span from the clip start, or from the end with align end. Optional visual passes provide alpha-aware lighting, texture, cutout and transition treatments; timing is constant, in, out or pulse. Optional text recipes animate title elements with typewriter, scramble, stagger (rise/flip/pop), wave, gradient and neon modes. Text seconds are entrance duration; stagger controls relative unit delays or wave phase; distance is in em. Text effects apply only to title elements. Blinds passes support horizontal/vertical strip direction and count. Tint remains a rectangular screen blend on non-text layers. Optional depth settings animate a flat element through perspective and focus. Text glitch adds seeded per-unit bursts; stagger supports depth/scatter/spiral entrances and exits. Particle passes can include particles settings for depth emitters and trails; repeat passes can include field settings for volume/tunnel/orbit and word/character repetition. These require kamikami-visual-v5. Passes warp (warpMode boil/liquid/melt), bevel, extrude, sheen (sheenStyle gloss/foil), paper, ink, pixel (pixelMode pixelate/dither/gameboy), dissolve, goo, glow and lens, the new channels/curves and channel spans require kamikami-visual-v6. Title text kinds mask (direction up/down/left/right), focus (variant soft/slam), stretch, swipe (direction left/right), slot, bounce (variant bounce/elastic), turn (direction left/right), highlight (variant marker/block; color = box), underline (color = line), outline, echo (color = outline), split, draw (color = stroke), flicker, count and circle (distance = spacing, speed = rotation) require kamikami-visual-v7; blurrise, karaoke (color = sung), shimmer (color/secondary), prism, bubbles, flap, roll, odometer and the line-sequence kinds retype, rotate, typeloop and morph (each text line is one step) are also v7. seconds/stagger/unit set timing and motion.direction out plays them as exits. Passes shape (shapeMode), doors (doorMode), clock (clockMode, count = blades), feather (angle = direction), lumawipe (lumaOrder), reflection, tiltshift, oldfilm, ripple (rippleMode) and cells (cellMode) are v7; for reveals strength 1 is fully hidden, so timing in reveals. Effect origin {x,y} in -1..1 sets the transform pivot for hinged 3D moves. Animation remains deterministic and instance-scoped. Recipes are declarative, no executable code.",
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
    await library.register(
      req.file.filename,
      req.file.originalname,
      req.file.size,
    ),
  );
});
app.get("/api/exports/:id", async (req, res) => {
  if (!/^[a-f0-9-]+\.mp4$/.test(req.params.id)) return res.sendStatus(404);
  res.download(path.join(data, "exports", req.params.id), "kamikami.mp4", {
    dotfiles: "allow",
  });
});

type Job = {
  id: string;
  status: "bundling" | "rendering" | "done" | "error";
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
