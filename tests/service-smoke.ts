import assert from "node:assert/strict";
import { initialProject, makeLayer } from "../src/model";

const base = "http://127.0.0.1:4318";
const headers = { "Content-Type": "application/json", "X-KamiKami": "test" };
const health = await (await fetch(base + "/api/health")).json();
assert.equal(health.ok, true);
assert.equal(
  (
    await fetch(base + "/api/project", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
  ).status,
  403,
);
assert.equal(
  (
    await fetch(base + "/api/project", {
      method: "PUT",
      headers: { ...headers, Origin: "https://example.com" },
      body: "{}",
    })
  ).status,
  403,
);
assert.equal(
  (await fetch(base + "/api/project", { method: "PUT", headers, body: "{}" }))
    .status,
  400,
);
const project = structuredClone(initialProject);
project.duration = 1;
project.layers = project.layers.map((l) => ({ ...l, duration: 1 }));
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACXBIWXMAAAABAAAAAQBPJcTWAAAAFUlEQVR4nGNgqKsjDY1qGNUwfDUAAHuf/AEglo3bAAAAAElFTkSuQmCC",
  "base64",
);
const wav = Buffer.alloc(44 + 44100 * 2);
wav.write("RIFF", 0);
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
for (let i = 0; i < 44100; i++)
  wav.writeInt16LE(
    Math.round(Math.sin((i / 44100) * 440 * 2 * Math.PI) * 1000),
    44 + i * 2,
  );
for (const [filename, type, bytes] of [
  ["smoke-image.png", "image", png],
  ["smoke-tone.wav", "audio", wav],
] as const) {
  const form = new FormData();
  form.append("file", new Blob([bytes]), filename);
  const response = await fetch(base + "/api/import", {
    method: "POST",
    headers: { "X-KamiKami": "test" },
    body: form,
  });
  assert.equal(response.status, 200);
  const { src } = await response.json();
  const catalog = await (await fetch(base + "/api/media")).json();
  assert.ok(
    catalog.some(
      (asset: { src: string; missing: boolean }) =>
        asset.src === src && !asset.missing,
    ),
  );
  const metadataResponse = await fetch(
    base + "/api/media/" + src.split("/").pop(),
    {
      method: "PUT",
      headers,
      body: JSON.stringify({
        duration: type === "audio" ? 1 : null,
        width: type === "image" ? 16 : null,
        height: type === "image" ? 16 : null,
        peaks: type === "audio" ? [0, 0.2, 0.5] : [],
      }),
    },
  );
  assert.equal(metadataResponse.status, 200);
  assert.equal((await metadataResponse.json()).name, filename);
  assert.equal((await fetch(base + src)).status, 200);
  project.layers.push({
    ...makeLayer(type, "Smoke test " + type),
    src,
    duration: 1,
    opacity: type === "image" ? 0.1 : 1,
    volume: 0.1,
  });
}
const response = await fetch(base + "/api/export", {
  method: "POST",
  headers,
  body: JSON.stringify(project),
});
const exportResult = await response.json();
assert.equal(response.status, 200, JSON.stringify(exportResult));
const { id } = exportResult;
for (let i = 0; i < 120; i++) {
  const job = await (await fetch(base + "/api/export/" + id)).json();
  if (job.status === "error") throw new Error(job.error);
  if (job.status === "done") {
    assert.equal(
      (await fetch(base + "/api/exports/" + id + ".mp4")).status,
      200,
    );
    console.log(
      "Service checks passed: request validation, media catalog/metadata, image/audio import, and MP4 export.",
    );
    console.log("Export:", id);
    process.exit(0);
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
throw new Error("Export smoke test timed out");
