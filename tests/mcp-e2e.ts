// End to end, isolated: a user creates a project in the editor, then an MCP
// client (as Claude Code would) imports media, builds a beat-cut music video,
// checks frames, saves and exports. Everything runs on its own ports with a
// temporary workspace, so it never touches a running app or `.kamikami/`.
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { openBrowser } from "@remotion/renderer";
import { createServer, type ViteDevServer } from "vite";
import { ffmpegPath, ffprobePath, run } from "../server/analysis/ffmpeg";

const servicePort = "4338";
const editorPort = "5183";
const root = path.resolve(".");
const work = await mkdtemp(path.join(tmpdir(), "kamikami-e2e-"));
const env = {
  ...process.env,
  KAMIKAMI_PORT: servicePort,
  KAMIKAMI_EDITOR_PORT: editorPort,
  KAMIKAMI_DATA: path.join(work, "workspace"),
} as Record<string, string>;
Object.assign(process.env, env);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let service: ChildProcess | undefined;
let vite: ViteDevServer | undefined;
let browser: Awaited<ReturnType<typeof openBrowser>> | undefined;
const client = new Client({ name: "claude-code-e2e", version: "1" });

// Synthetic media: a 120 BPM song, a landscape clip with sound, a portrait clip, a still.
const media = (name: string) => path.join(work, name);
const lavfi = (args: string[]) =>
  run(ffmpegPath(), ["-y", "-loglevel", "error", ...args]);
await lavfi([
  "-f",
  "lavfi",
  "-i",
  "aevalsrc='0.6*sin(2*PI*55*t)*exp(-12*mod(t\\,0.5))+0.12*sin(2*PI*440*t)':s=44100:d=12",
  "-c:a",
  "aac",
  media("song.m4a"),
]);
await lavfi([
  "-f",
  "lavfi",
  "-i",
  "testsrc2=s=640x360:r=30:d=6",
  "-f",
  "lavfi",
  "-i",
  "sine=f=220:d=6",
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-shortest",
  media("city.mp4"),
]);
await lavfi([
  "-f",
  "lavfi",
  "-i",
  "mandelbrot=s=360x640:r=30",
  "-t",
  "6",
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  media("portrait.mp4"),
]);
await lavfi([
  "-f",
  "lavfi",
  "-i",
  "gradients=s=600x600",
  "-frames:v",
  "1",
  media("cover.png"),
]);

try {
  service = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    cwd: root,
    env,
    stdio: ["ignore", "ignore", "inherit"],
  });
  for (let i = 0; ; i++) {
    const ok = await fetch(`http://127.0.0.1:${servicePort}/api/health`)
      .then((r) => r.ok)
      .catch(() => false);
    if (ok) break;
    if (i > 120) throw new Error("The service did not start.");
    await sleep(500);
  }
  vite = await createServer({
    root,
    configFile: path.join(root, "vite.config.ts"),
    server: { host: "127.0.0.1" },
    logLevel: "error",
  });
  await vite.listen();
  browser = await openBrowser("chrome", { logLevel: "error" });
  const page = await browser.newPage({
    context: () => null,
    logLevel: "error",
    indent: false,
    pageIndex: 0,
    onBrowserLog: null,
    onLog: () => {},
  });
  // The user's project file, without native dialogs. A string, because tsx
  // would wrap functions in helpers the page doesn't have.
  await page.evaluateOnNewDocument(`
    window.kamikamiProjectFiles = {
      info: async () => ({ file: localStorage.getItem("e2e-file") ? { name: "video.json" } : null }),
      open: async () => null,
      accept: async () => ({ name: "video.json" }),
      save: async (text) => { localStorage.setItem("e2e-file", text); return { name: "video.json" }; },
      forget: async () => localStorage.removeItem("e2e-file"),
    };
  `);
  await page.setViewport({ width: 1440, height: 980, deviceScaleFactor: 1 });
  await page.goto({ url: `http://127.0.0.1:${editorPort}`, timeout: 60000 });
  const until = async (fn: () => boolean) => {
    for (let i = 0; i < 300; i++) {
      if (await page.evaluate(fn)) return;
      await sleep(100);
    }
    throw new Error("UI condition timed out: " + fn);
  };
  const clickText = (selector: string, text: string) =>
    page.evaluate(
      (s: string, t: string) => {
        const e = [...document.querySelectorAll<HTMLElement>(s)].find(
          (b) => b.textContent?.trim() === t,
        );
        if (!e) throw new Error("Missing " + t);
        e.click();
      },
      selector,
      text,
    );

  // The user: New project, a custom 540 × 960 frame at 30 fps.
  await until(() =>
    [...document.querySelectorAll("header button")].some(
      (b) =>
        b.textContent?.includes("New project") &&
        !(b as HTMLButtonElement).disabled,
    ),
  );
  await clickText("header button", "New project");
  await sleep(300);
  await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("dialog[open] button")]
      .find((b) => /don.t save|discard/i.test(b.textContent ?? ""))
      ?.click(),
  );
  await until(
    () =>
      document.querySelector("dialog[open] h2")?.textContent === "New project",
  );
  const pick = async (label: string, text: string) => {
    await page.evaluate(
      (l: string) =>
        document
          .querySelector<HTMLElement>(`dialog[open] [aria-label="${l}"]`)!
          .click(),
      label,
    );
    await sleep(150);
    await page.evaluate((t: string) => {
      const o = [
        ...document.querySelectorAll<HTMLElement>('[role="option"]'),
      ].find((o) => o.textContent?.includes(t));
      if (!o) throw new Error("Missing option " + t);
      o.click();
    }, text);
    await sleep(150);
  };
  await pick("Size", "Custom size");
  await page.evaluate(() => {
    const set = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    const inputs = [
      ...document.querySelectorAll<HTMLInputElement>("dialog[open] input"),
    ];
    for (const [input, value] of [
      [inputs[0], "E2E music video"],
      [inputs[1], "540"],
      [inputs[2], "960"],
    ] as const) {
      set.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await pick("Frame rate", "30 fps");
  await clickText("dialog[open] button", "Create project");
  await until(() => !document.querySelector("dialog[open]"));

  // The agent.
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [path.resolve("server/mcp.mjs")],
      env,
      stderr: "inherit",
    }),
  );
  const tools = new Map(
    (await client.listTools()).tools.map((t) => [t.name, t]),
  );
  // The editing skill reaches clients as a resource and as a prompt.
  const skill = await client.readResource({ uri: "kamikami://editing-skill" });
  assert.match(
    (skill.contents[0] as { text: string }).text,
    /^---\nname: kamikami-editor/,
  );
  assert.ok(
    (await client.listPrompts()).prompts.some(
      (p) => p.name === "editing-skill",
    ),
  );
  const prompt = await client.getPrompt({ name: "editing-skill" });
  assert.match(
    (prompt.messages[0].content as { text: string }).text,
    /Making videos with KamiKami/,
  );
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    if (
      (tools.get(name)?.inputSchema.properties as Record<string, unknown>)
        ?.expectedRevision
    ) {
      const live = await call("get_project");
      args = { ...args, expectedRevision: live.revision };
    }
    const r = await client.callTool({ name, arguments: args }, undefined, {
      timeout: 300000,
    });
    const content = r.content as { type: string; text?: string }[];
    const text = content.find((c) => c.type === "text")?.text ?? "";
    if (r.isError) throw new Error(`${name}: ${text}`);
    const value = JSON.parse(text);
    return content.some((c) => c.type === "image")
      ? { ...value, hasImage: true }
      : value;
  };

  let p = await call("get_project");
  assert.deepEqual(
    [p.project.name, p.project.width, p.project.height, p.project.fps],
    ["E2E music video", 540, 960, 30],
    "the user's format",
  );
  const src: Record<string, string> = {};
  for (const name of ["song.m4a", "city.mp4", "portrait.mp4", "cover.png"]) {
    const asset = await call("import_media", { path: media(name) });
    assert.ok(asset.type === "image" || asset.duration > 0, `${name} measured`);
    src[name] = asset.src;
  }
  await call("analyze_assets", { tier: "probe" });
  let library: any[] = [];
  for (let i = 0; i < 120; i++) {
    library = await call("get_media_library");
    if (library.every((a) => a.analysis?.status === "ready")) break;
    await sleep(500);
  }
  const songInfo = await call("get_asset_analysis", { src: src["song.m4a"] });
  assert.ok(songInfo.tempo, "the probe finds the song's tempo");
  assert.ok(
    Math.abs(songInfo.tempo.bpm - 120) < 1,
    `${songInfo.tempo.bpm} BPM`,
  );
  const beat = 60 / songInfo.tempo.bpm;

  await call("set_project_settings", { duration: 12, exportLoudness: -14 });
  const video = (await call("get_project")).project.tracks[0].id;
  await call("create_track", { track: { id: "music", name: "Music" } });
  await call("reorder_tracks", { trackIds: ["music", video] });
  await call("create_track", { track: { id: "titles", name: "Titles" } });
  await call("add_media", { src: src["song.m4a"], trackId: "music" });
  // Cuts every 6 beats (3 s at 120 BPM); the last shot starts 2 s into its source.
  const shots: [string, number][] = [
    ["city.mp4", 0],
    ["portrait.mp4", 0],
    ["cover.png", 0],
    ["city.mp4", 2],
  ];
  for (const [i, [name, offset]] of shots.entries())
    p = await call("add_media", {
      src: src[name],
      trackId: video,
      start: i * 6 * beat,
      duration: 6 * beat,
      offset,
    });
  assert.equal(p.project.layers.at(-1).offset, 2, "source in-point");
  // Fill the portrait frame and silence the camera sound.
  const { width: W, height: H } = p.project;
  for (const l of p.project.layers.filter((l: any) => l.type !== "audio")) {
    const a = library.find((a) => a.src === l.src);
    const scale =
      Math.max(W / a.width, H / a.height) / Math.min(W / a.width, H / a.height);
    await call("update_layer", {
      layerId: l.id,
      patch: { scale, ...(l.type === "video" ? { muted: true } : {}) },
    });
  }

  // Title in an imported font, with one effect per role.
  const font = await call("import_font", {
    path: path.resolve("public/fonts/builtin/Amiri-Bold.ttf"),
  });
  assert.ok((await call("list_fonts", { query: font.family })).length);
  p = await call("add_text", {
    text: "E2E",
    trackId: "titles",
    start: 0,
    duration: 8 * beat,
  });
  const title = p.project.layers.at(-1);
  p = await call("update_layer", {
    layerId: title.id,
    patch: { fontId: font.fontId, fontSize: 140 },
  });
  assert.ok(
    p.project.fonts?.some((f: any) => f.id === font.fontId),
    "imported font joins the project",
  );
  for (const role of ["in", "throughout", "out"]) {
    const found = await call("find_effects", {
      role,
      elementType: "title",
      limit: 1,
    });
    await call("apply_effect", {
      effectId: found.effects[0].id,
      layerIds: [title.id],
    });
  }
  p = await call("apply_effect", {
    effectId: "kinetic-beathop",
    layerIds: [title.id],
  });
  p = await call("update_effect_instance", {
    layerId: title.id,
    effectId: "kinetic-beathop",
    patch: { text: { tempo: songInfo.tempo.bpm } },
  });
  const hop = p.project.layers
    .find((l: any) => l.id === title.id)
    .effects.find((e: any) => e.effectId === "kinetic-beathop").settings.text;
  assert.deepEqual([hop.kind, hop.tempo], ["beathop", songInfo.tempo.bpm]);
  await call("add_backdrop", { backdrop: { kind: "gradient" } });
  const ordered = (await call("get_project")).project.layers
    .filter((l: any) => l.trackId === video)
    .sort((a: any, b: any) => a.start - b.start);
  p = await call("crossfade", {
    fromLayerId: ordered[0].id,
    toLayerId: ordered[1].id,
    seconds: beat,
  });
  const faded = p.project.layers.find((l: any) => l.id === ordered[1].id);
  assert.notEqual(faded.trackId, "titles", "crossfades stay off title tracks");
  const song = p.project.layers.find((l: any) => l.type === "audio");
  await call("update_layer", { layerId: song.id, patch: { fadeOut: 1 } });
  await call("set_keyframes", {
    layerId: ordered[2].id,
    property: "scale",
    keyframes: [
      { time: 0, value: ordered[2].scale },
      { time: 4 * beat, value: ordered[2].scale * 1.1 },
    ],
  });
  await call("create_effect", {
    effect: {
      id: "e2e-pulse",
      name: "E2E pulse",
      channels: [{ property: "scale", curve: "pulse", from: 1, to: 1.05 }],
    },
  });
  assert.equal(
    (await call("get_project")).editing,
    false,
    "creating an effect leaves the editor free",
  );
  await call("apply_effect", {
    effectId: "e2e-pulse",
    layerIds: [ordered[2].id],
  });

  // Check, save, export.
  assert.ok((await call("render_frame", { frame: 45 })).hasImage);
  assert.ok(
    (await call("view_timeline_range", { start: 1.5, end: 2.5, frames: 2 }))
      .hasImage,
  );
  p = await call("save_project");
  assert.equal(p.projectFile, null, "no file until the user picks one");
  // The user presses Save once to choose a file (once the button is ready).
  await until(() =>
    [...document.querySelectorAll<HTMLButtonElement>("header button")].some(
      (b) => b.textContent?.trim() === "Save" && !b.disabled,
    ),
  );
  await clickText("header button", "Save");
  await until(() => !!localStorage.getItem("e2e-file"));
  p = await call("update_layer", {
    layerId: title.id,
    patch: { color: "#39f3ff" },
  });
  p = await call("save_project");
  assert.deepEqual([p.projectFile, p.fileSaved], ["video.json", true]);
  const saved = JSON.parse(
    await page.evaluate(() => localStorage.getItem("e2e-file")!),
  );
  assert.equal(
    saved.layers.find((l: any) => l.id === title.id).color,
    "#39f3ff",
  );
  const job = (await call("export_video")).job;
  let status;
  for (let i = 0; i < 300; i++) {
    status = await call("get_export", { jobId: job.id });
    if (status.status === "done" || status.status === "error") break;
    await sleep(2000);
  }
  assert.equal(status.status, "done", status.error);
  const { stdout } = await run(ffprobePath(), [
    "-v",
    "error",
    "-show_entries",
    "stream=codec_type,width,height,r_frame_rate:format=duration",
    "-of",
    "json",
    status.file,
  ]);
  const probe = JSON.parse(stdout);
  const videoStream = probe.streams.find((s: any) => s.codec_type === "video");
  assert.deepEqual(
    [videoStream.width, videoStream.height, videoStream.r_frame_rate],
    [540, 960, "30/1"],
  );
  assert.ok(probe.streams.some((s: any) => s.codec_type === "audio"));
  assert.ok(Math.abs(Number(probe.format.duration) - 12) < 0.1);
  console.log(
    `MCP end-to-end passed: ${tools.size} tools, export ${status.file}`,
  );
} finally {
  await client.close().catch(() => {});
  await browser?.close({ silent: true }).catch(() => {});
  await vite?.close();
  service?.kill();
  await sleep(300);
  await rm(work, { recursive: true, force: true });
}
