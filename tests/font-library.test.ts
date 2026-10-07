import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, unlink } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { brotliCompressSync, deflateSync } from "node:zlib";
import { FontLibrary, MAX_FONT_BYTES } from "../server/font-library";
import { readFontMetadata } from "../server/font-metadata";
import {
  builtinFonts,
  fontChoice,
  fontCSS,
  fontVariant,
  fontWeights,
} from "../src/font-assets";
import { initialProject, validateProject } from "../src/model";
import { EditHistory } from "../src/history";
import { splitClips } from "../src/editor/editing";

const publicDir = path.resolve("public");
const read = (name: string) =>
  readFile(path.join(publicDir, "fonts/builtin", name));

// Losslessly wrap real TTF tables, so compressed metadata paths are exercised too.
function webFont(ttf: Buffer, version: 1 | 2) {
  const count = ttf.readUInt16BE(4);
  const entries = Array.from({ length: count }, (_, i) => {
    const p = 12 + 16 * i;
    return {
      tag: ttf.subarray(p, p + 4),
      checksum: ttf.readUInt32BE(p + 4),
      bytes: ttf.subarray(
        ttf.readUInt32BE(p + 8),
        ttf.readUInt32BE(p + 8) + ttf.readUInt32BE(p + 12),
      ),
    };
  });
  if (version === 1) {
    const header = Buffer.alloc(44 + 20 * count);
    header.write("wOFF");
    header.writeUInt32BE(ttf.readUInt32BE(0), 4);
    header.writeUInt16BE(count, 12);
    header.writeUInt32BE(ttf.length, 16);
    let offset = header.length;
    const chunks: Buffer[] = [header];
    entries.forEach((entry, i) => {
      const compressed = deflateSync(entry.bytes);
      const data =
        compressed.length < entry.bytes.length ? compressed : entry.bytes;
      const p = 44 + i * 20;
      entry.tag.copy(header, p);
      header.writeUInt32BE(offset, p + 4);
      header.writeUInt32BE(data.length, p + 8);
      header.writeUInt32BE(entry.bytes.length, p + 12);
      header.writeUInt32BE(entry.checksum, p + 16);
      const padding = Buffer.alloc((4 - (data.length % 4)) % 4);
      chunks.push(data, padding);
      offset += data.length + padding.length;
    });
    header.writeUInt32BE(offset, 8);
    return Buffer.concat(chunks);
  }
  const uint128 = (value: number) => {
    const bytes = [value & 127];
    while ((value = Math.floor(value / 128)))
      bytes.unshift((value & 127) | 128);
    return Buffer.from(bytes);
  };
  const directory = Buffer.concat(
    entries.map((entry) =>
      Buffer.concat([
        Buffer.from([
          (["glyf", "loca"].includes(entry.tag.toString()) ? 192 : 0) | 63,
        ]),
        entry.tag,
        uint128(entry.bytes.length),
      ]),
    ),
  );
  const data = brotliCompressSync(Buffer.concat(entries.map((e) => e.bytes)));
  const header = Buffer.alloc(48);
  header.write("wOF2");
  header.writeUInt32BE(ttf.readUInt32BE(0), 4);
  header.writeUInt32BE(header.length + directory.length + data.length, 8);
  header.writeUInt16BE(count, 12);
  header.writeUInt32BE(ttf.length, 16);
  header.writeUInt32BE(data.length, 20);
  return Buffer.concat([header, directory, data]);
}

test("every bundled face exists and declares the weights/styles contained in its bytes", async () => {
  assert.equal(builtinFonts.length, 20);
  const seen = new Set<string>();
  for (const font of builtinFonts) {
    assert.ok(!seen.has(font.id));
    seen.add(font.id);
    for (const face of font.variants) {
      const metadata = readFontMetadata(
        await readFile(path.join(publicDir, face.src)),
      );
      assert.equal(face.weightMin, metadata.weightMin, font.family);
      assert.equal(face.weightMax, metadata.weightMax, font.family);
      assert.equal(face.style, metadata.style, font.family);
    }
    const selected = fontChoice(font, 800, "italic");
    assert.ok(fontVariant(font, selected.fontWeight, selected.fontStyle));
    assert.ok(
      fontWeights(font, selected.fontStyle).includes(selected.fontWeight),
    );
  }
  assert.match(
    await readFile(path.join(publicDir, "fonts/LICENSES.txt"), "utf8"),
    /SIL OPEN FONT LICENSE/i,
  );
});

test("font metadata handles static and variable TTF, WOFF, and WOFF2", async () => {
  const ttf = await read("Rubik-BoldItalic.ttf");
  const expected = readFontMetadata(ttf);
  assert.equal(expected.family, "Rubik");
  assert.equal(expected.style, "italic");
  assert.equal(expected.weightMin, 700);
  assert.deepEqual(readFontMetadata(webFont(ttf, 1)), expected);
  assert.deepEqual(readFontMetadata(webFont(ttf, 2)), expected);
  const variable = readFontMetadata(
    await read("HostGrotesk-VariableFont_wght.ttf"),
  );
  assert.equal(variable.weightMin, 300);
  assert.equal(variable.weightMax, 800);
  assert.throws(() => readFontMetadata(Buffer.from("not a font")));
  assert.throws(() => readFontMetadata(ttf.subarray(0, 100)));
  const broken = webFont(ttf, 2);
  broken.writeUInt32BE(128 * 1024 * 1024, 16);
  assert.throws(() => readFontMetadata(broken), /64 MB/);
});

test("font imports persist across library instances, deduplicate and merge concurrent faces", async () => {
  const data = await mkdtemp(path.join(tmpdir(), "kamikami-fonts-"));
  try {
    const library = new FontLibrary(data, publicDir);
    const regular = await read("Rubik-Regular.ttf"),
      bold = await read("Rubik-Bold.ttf");
    const [first, second] = await Promise.all([
      library.import(regular, "regular.ttf"),
      library.import(bold, "bold.ttf"),
    ]);
    assert.equal(first.id, second.id);
    assert.equal(second.variants.length, 2);
    const again = await library.import(regular, "different-filename.ttf");
    assert.equal(again.variants.length, 2);
    assert.equal((await readdir(path.join(data, "fonts"))).length, 2);
    const reopened = new FontLibrary(data, publicDir);
    assert.deepEqual((await reopened.list())[0], { ...again, missing: false });
    const project = validateProject({
      ...initialProject,
      fonts: [again],
      layers: initialProject.layers.map((l) =>
        l.id === "title" ? { ...l, ...fontChoice(again, 700) } : l,
      ),
    });
    await reopened.assertAvailable(project);
    const face = fontVariant(again, 700, "normal")!;
    await unlink(path.join(data, "fonts", path.basename(face.src)));
    assert.equal((await reopened.list())[0].missing, true);
    await assert.rejects(
      reopened.assertAvailable(project),
      /Missing font “Rubik”/,
    );
    await reopened.import(bold, "bold.ttf");
    await reopened.assertAvailable(project);
    await assert.rejects(library.import(Buffer.from("bad"), "bad.ttf"));
    await assert.rejects(library.import(regular, "bad.exe"));
    await assert.rejects(library.import(regular, "bad.woff2"), /extension/);
    await assert.rejects(
      library.import(Buffer.alloc(MAX_FONT_BYTES + 1), "big.ttf"),
      /20 MB/,
    );
    assert.equal((await reopened.list()).length, 1);
  } finally {
    await rm(data, { recursive: true, force: true });
  }
});

test("font asset snapshots survive JSON, split and Undo/Redo, and reject invalid references", async () => {
  const font = builtinFonts.find((f) => f.family === "Host Grotesk")!;
  const project = validateProject({
    ...initialProject,
    layers: initialProject.layers.map((l) =>
      l.id === "title" ? { ...l, ...fontChoice(font, 500, "italic") } : l,
    ),
  });
  const restored = validateProject(JSON.parse(JSON.stringify(project)));
  const split = splitClips(
    restored,
    ["title"],
    48,
    () => "split-title",
  ).project.layers.find((l) => l.id === "split-title")!;
  assert.equal(split.fontId, font.id);
  assert.equal(split.fontWeight, 500);
  assert.equal(split.fontStyle, "italic");
  const history = new EditHistory<typeof project>();
  history.record(initialProject);
  assert.deepEqual(history.undo(project), initialProject);
  assert.deepEqual(history.redo(initialProject), project);
  const invalid = (patch: object) =>
    validateProject({
      ...project,
      layers: project.layers.map((l) =>
        l.id === "title" ? { ...l, ...patch } : l,
      ),
    });
  assert.throws(() => invalid({ fontId: "builtin-unknown" }), /Unknown font/);
  assert.throws(() => invalid({ fontWeight: 900 }), /Unsupported weight/);
  assert.throws(() => invalid({ fontId: "url(https://example.com/font)" }));
  const custom = { ...font, id: "custom-" + "a".repeat(24) };
  assert.throws(
    () => validateProject({ ...initialProject, fonts: [custom] }),
    /imported font assets/,
  );
  assert.notEqual(fontCSS(font, 500, "normal"), fontCSS(font, 500, "italic"));
});
