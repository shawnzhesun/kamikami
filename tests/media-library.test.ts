import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { MediaLibrary } from "../server/media-library";
import { emptyMetadata } from "../src/media";

test("media catalog discovers legacy files, persists metadata, detects missing files and serializes imports", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "kamikami-library-"));
  try {
    await mkdir(path.join(dir, "media"));
    await writeFile(path.join(dir, "media", "old.wav"), "wave");
    await writeFile(
      path.join(dir, "project.json"),
      JSON.stringify({
        layers: [{ src: "/media/old.wav", name: "Existing sound" }],
      }),
    );
    const library = new MediaLibrary(dir);
    const old = (await library.list())[0];
    assert.equal(old.name, "Existing sound");
    assert.equal(old.size, 4);
    assert.equal(old.missing, false);
    await library.update(old.src, {
      ...emptyMetadata,
      duration: 3,
      peaks: [0, 0.5, 1],
    });
    await Promise.all([
      library.register("a.png", "Image A", 0),
      library.register("b.mp4", "Video B", 0),
    ]);
    const persisted = await new MediaLibrary(dir).list();
    assert.equal(persisted.length, 3);
    assert.deepEqual(
      persisted.find((a) => a.src === old.src)?.peaks,
      [0, 0.5, 1],
    );
    assert.equal(
      persisted.find((a) => a.src === "/media/a.png")?.missing,
      true,
    );
    await rm(path.join(dir, "media", "old.wav"));
    assert.equal(
      (await library.list()).find((a) => a.src === old.src)?.missing,
      true,
    );
    await writeFile(path.join(dir, "media", "replacement.wav"), "wave");
    await library.register("replacement.wav", "Replacement", 4);
    await library.replaceMissing(old.src, "/media/replacement.wav");
    assert.ok(!(await library.list()).some((a) => a.src === old.src));
    await assert.rejects(
      library.replaceMissing(
        "/media/replacement.wav",
        "/media/replacement.wav",
      ),
      /Only missing/,
    );
    await assert.rejects(
      library.replaceMissing("/media/a.png", "/media/replacement.wav"),
      /type must match/,
    );
    await assert.rejects(
      library.update("/media/../../secret", emptyMetadata),
      /Invalid media path/,
    );
    await assert.rejects(
      library.update(old.src, { ...emptyMetadata, peaks: [2] }),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
