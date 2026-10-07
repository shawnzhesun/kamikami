import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtemp, writeFile, readFile, rename } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import type { Project } from "../src/model";
const client = new Client({
  name: "KamiKami comprehensive QA",
  version: "1",
});
const folder = await mkdtemp(path.join(tmpdir(), "kamikami-mcp-workflow-"));
const called = new Set<string>();
type Snapshot = {
  project: Project;
  revision: string;
  selectedLayerIds: string[];
  frame: number;
  editing: boolean;
  playing: boolean;
};
let before: Snapshot | undefined,
  last: Snapshot | undefined,
  missing: { from: string; to: string } | undefined;
async function raw(name: string, args: Record<string, unknown> = {}) {
  called.add(name);
  const r = await client.callTool({ name, arguments: args }, undefined, {
    timeout: 150000,
  });
  if (r.isError) throw new Error(name + ": " + JSON.stringify(r.content));
  return r;
}
async function call(name: string, args: Record<string, unknown> = {}) {
  const r = await raw(name, args);
  const text = (r.content as any[]).find((c) => c.type === "text")?.text;
  const value = JSON.parse(text);
  if (value.revision && value.project) last = value;
  return value;
}
async function edit(name: string, args: Record<string, unknown> = {}) {
  const expected = last?.revision;
  const live: Snapshot = await call("get_project");
  if (expected)
    assert.equal(live.revision, expected, "Manual edit during test; stopping");
  assert.equal(live.editing, false, "An editor field is active");
  return call(name, { ...args, expectedRevision: live.revision });
}
try {
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [path.resolve("server/mcp.mjs")],
      stderr: "pipe",
    }),
  );
  const tools = await client.listTools();
  assert.ok(tools.tools.length >= 35);
  await client.readResource({ uri: "kamikami://editing-skill" });
  before = await call("get_project");
  last = before;
  await writeFile(path.join(folder, "before.json"), JSON.stringify(before));
  const capabilities = await call("get_capabilities");
  assert.ok(capabilities.effect.properties.channels);
  const qaTrackId = crypto.randomUUID();
  await edit("create_track", {
    track: { id: qaTrackId, name: "QA empty layer" },
  });
  await edit("update_track", {
    track: { id: qaTrackId, name: "QA renamed layer" },
  });
  await edit("reorder_tracks", {
    trackIds: last!.project.tracks!.map((t) => t.id).reverse(),
  });
  await edit("delete_track", { trackId: qaTrackId });
  await call("get_effect_library");
  await call("get_media_library");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACXBIWXMAAAABAAAAAQBPJcTWAAAAFUlEQVR4nGNgqKsjDY1qGNUwfDUAAHuf/AEglo3bAAAAAElFTkSuQmCC",
    "base64",
  );
  await writeFile(path.join(folder, "qa-image.png"), png);
  const wav = Buffer.alloc(44 + 44100 * 2 * 4);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(44100, 24);
  wav.writeUInt32LE(88200, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  await writeFile(path.join(folder, "qa-audio.wav"), wav);
  const img = await call("import_media", {
    path: path.join(folder, "qa-image.png"),
  });
  const audio = await call("import_media", {
    path: path.join(folder, "qa-audio.wav"),
  });
  await call("analyze_media", { src: img.src });
  await call("analyze_media", { src: audio.src });
  const media = await call("get_media_library");
  assert.equal(media.find((a: any) => a.src === img.src).width, 16);
  assert.equal(media.find((a: any) => a.src === audio.src).duration, 4);
  await edit("add_media", { src: img.src, start: 0, duration: 3 });
  const imageId = last!.project.layers.at(-1)!.id;
  await edit("add_media", { src: audio.src, start: 0, duration: 3 });
  const audioId = last!.project.layers.at(-1)!.id;
  await edit("update_layer", {
    layerId: audioId,
    patch: { muted: true, solo: true, volume: 0.4 },
  });
  assert.equal(last!.project.layers.at(-1)!.volume, 0.4);
  await edit("add_text", {
    text: "Agent workflow",
    name: "QA title",
    duration: 3,
  });
  const titleId = last!.project.layers.at(-1)!.id;
  await edit("update_layer", {
    layerId: titleId,
    patch: {
      x: 30,
      y: -20,
      scale: 1.1,
      rotation: 5,
      opacity: 0.8,
      fontSize: 70,
      color: "#F2765E",
    },
  });
  assert.equal(last!.project.layers.at(-1)!.x, 30);
  await call("select_layers", { layerIds: [titleId, imageId] });
  await call("set_playhead", { frame: 24 });
  assert.equal((await call("get_project")).frame, 24);
  await call("set_playback", { playing: true });
  assert.equal((await call("get_project")).playing, true);
  await call("set_playback", { playing: false });
  await edit("move_clips", { layerIds: [titleId], delta: 1 });
  assert.equal(last!.project.layers.at(-1)!.start, 1);
  await edit("trim_clip", { layerId: titleId, edge: "left", position: 1.5 });
  assert.equal(last!.project.layers.at(-1)!.effectOffset, 0.5);
  await edit("split_clips", { layerIds: [titleId], frame: 60 });
  assert.equal(
    last!.project.layers.filter((l) => l.name.startsWith("QA title")).length,
    2,
  );
  await edit("duplicate_layers", { layerIds: [imageId] });
  const copyId = last!.project.layers.find((l) =>
    l.name.endsWith("(copy)"),
  )!.id;
  await edit("delete_layers", { layerIds: [copyId] });
  await edit("reorder_layers", {
    layerIds: [...last!.project.layers].reverse().map((l) => l.id),
  });
  const confirm = await edit("delete_media", { src: img.src });
  assert.equal(confirm.requiresConfirmation, true);
  assert.ok(confirm.affectedLayers.some((l: any) => l.id === imageId));
  await edit("delete_media", { src: img.src, confirmUsed: true });
  assert.ok(!last!.project.layers.some((l) => l.src === img.src));
  assert.ok(
    !(await call("get_media_library")).some((a: any) => a.src === img.src),
  );
  await edit("undo");
  assert.ok(last!.project.layers.some((l) => l.src === img.src));
  await call("get_media_library");
  await edit("redo");
  assert.ok(!last!.project.layers.some((l) => l.src === img.src));
  await call("restore_media", { src: img.src });
  await edit("undo");
  // Only the test's imported file is moved to exercise missing-source recovery.
  missing = {
    from: path.resolve(".kamikami" + img.src),
    to: path.join(folder, "missing.png"),
  };
  await rename(missing.from, missing.to);
  await call("get_media_library");
  const replacement = await call("import_media", {
    path: path.join(folder, "qa-image.png"),
  });
  await call("analyze_media", { src: replacement.src });
  await edit("relink_media", { src: img.src, replacement: replacement.src });
  assert.ok(last!.project.layers.some((l) => l.src === replacement.src));
  await rename(missing.to, missing.from);
  missing = undefined;
  const effect = {
    id: "qa-effect-" + Date.now(),
    name: "QA fade",
    description: "Temporary verification effect",
    color: "#F2765E",
    tint: 0,
    channels: [
      {
        property: "opacity",
        curve: "linear",
        from: 0,
        to: 1,
        frequency: 0,
        phase: 0,
      },
    ],
  };
  await edit("create_effect", { effect });
  await edit("update_effect", {
    effectId: effect.id,
    patch: { description: "Verified authoring" },
  });
  await edit("apply_effect", { effectId: effect.id, layerIds: [imageId] });
  const r0 = await raw("render_frame", {
    frame: 0,
    expectedRevision: last!.revision,
  });
  const i0 = (r0.content as any[]).find((c) => c.type === "image");
  assert.ok(i0?.data);
  const job0 = JSON.parse(
    (r0.content as any[]).find((c) => c.type === "text").text,
  );
  await raw("get_render", { jobId: job0.id });
  const r1 = await raw("render_frame", {
    frame: 48,
    expectedRevision: last!.revision,
  });
  const i1 = (r1.content as any[]).find((c) => c.type === "image");
  assert.ok(i1?.data);
  assert.notEqual(i0.data, i1.data);
  await writeFile(
    path.join(folder, "frame-0.png"),
    Buffer.from(i0.data, "base64"),
  );
  await writeFile(
    path.join(folder, "frame-48.png"),
    Buffer.from(i1.data, "base64"),
  );
  const saved = await edit("save_user_effect", {
    effectId: effect.id,
    author: "KamiKami QA",
    license: "CC0-1.0",
  });
  const portable = await call("export_effect_bundle", {
    userEffectId: saved.userEffect.id,
  });
  assert.equal(portable.engine, "frameforge-curves-v1");
  const imported = await call("import_effect_bundle", { bundle: portable });
  assert.notEqual(
    imported.userEffect.bundle.effect.id,
    saved.userEffect.bundle.effect.id,
  );
  await edit("apply_effect", {
    effectId: imported.userEffect.bundle.effect.id,
    layerIds: [titleId],
  });
  await edit("remove_effect", { effectId: effect.id, layerIds: [imageId] });
  const stale = await client.callTool({
    name: "update_layer",
    arguments: {
      layerId: titleId,
      patch: { x: 0 },
      expectedRevision: before!.revision,
    },
  });
  assert.equal(stale.isError, true);
  const bad = await client.callTool({
    name: "import_effect_bundle",
    arguments: { bundle: { ...portable, version: 99 } },
  });
  assert.equal(bad.isError, true);
  await edit("set_project_settings", {
    duration: 1,
    trimAffected: true,
    name: "QA export",
  });
  const exported = await edit("export_video");
  let job = exported.job;
  for (let i = 0; i < 120 && !["done", "error"].includes(job.status); i++) {
    await new Promise((r) => setTimeout(r, 500));
    job = await call("get_export", { jobId: job.id });
  }
  assert.equal(job.status, "done");
  const video = await call("import_media", {
    path: path.resolve(".kamikami/exports/" + job.id + ".mp4"),
  });
  await call("analyze_media", { src: video.src });
  await edit("add_media", { src: video.src, start: 0, duration: 1 });
  await edit("apply_project", { project: last!.project });
  await call("save_project");
  console.log("Passed: " + [...called].sort().join(", "));
  await writeFile(
    path.join(folder, "coverage.json"),
    JSON.stringify(
      {
        tools: [...called].sort(),
        advertised: tools.tools.map((t) => t.name).sort(),
      },
      null,
      2,
    ),
  );
  assert.deepEqual([...called].sort(), tools.tools.map((t) => t.name).sort());
} finally {
  try {
    if (missing) await rename(missing.to, missing.from);
    if (before && last) {
      const expected = last.revision;
      const live = await call("get_project");
      if (live.revision !== expected)
        throw new Error("Intervening edit; refusing to overwrite it.");
      await call("apply_project", {
        project: before.project,
        expectedRevision: live.revision,
      });
      await call("select_layers", { layerIds: before.selectedLayerIds });
      await call("set_playhead", { frame: before.frame });
      await call("save_project");
      assert.deepEqual((await call("get_project")).project, before.project);
      console.log("Original composition restored. Artifacts: " + folder);
    }
  } finally {
    await client.close();
  }
}
