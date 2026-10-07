import test from "node:test";
import assert from "node:assert/strict";
import { loadFontAsset, validateFontFile } from "../src/font-loading";
import { builtinFonts, fontFaceName } from "../src/font-assets";

test("preview and picker share face loading, failures can retry, and versions have distinct CSS names", async () => {
  const originalFace = Object.getOwnPropertyDescriptor(globalThis, "FontFace");
  const originalDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    "document",
  );
  const added: unknown[] = [];
  const calls: {
    family: string;
    src: string | ArrayBuffer;
    descriptors: unknown;
  }[] = [];
  let fail = false;
  class FakeFontFace {
    constructor(
      family: string,
      src: string | ArrayBuffer,
      descriptors: unknown,
    ) {
      calls.push({ family, src, descriptors });
    }
    async load() {
      if (fail) throw new Error("Failed to decode font");
      return this;
    }
  }
  Object.defineProperty(globalThis, "FontFace", {
    configurable: true,
    value: FakeFontFace,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { fonts: { add: (face: unknown) => added.push(face) } },
  });
  try {
    const font = builtinFonts.find((f) => f.family === "Host Grotesk")!;
    const one = loadFontAsset(font, 400, "normal");
    const two = loadFontAsset(font, 700, "normal");
    assert.equal(one, two);
    assert.equal(
      added.length,
      0,
      "Do not register a face before it has loaded",
    );
    await one;
    assert.equal(added.length, 1);
    assert.equal(calls[0].family, fontFaceName(font, 400, "normal"));
    assert.deepEqual(calls[0].descriptors, {
      weight: "300 800",
      style: "normal",
    });
    await loadFontAsset(font, 400, "normal", "http://127.0.0.1:4318");
    assert.match(
      calls[1].src as string,
      /http:\/\/127.0.0.1:4318\/fonts\/builtin\//,
    );
    assert.equal(
      calls[0].family,
      calls[1].family,
      "Export uses the same face name",
    );
    fail = true;
    await assert.rejects(loadFontAsset(font, 400, "italic"), /Reimport/);
    const before = calls.length;
    fail = false;
    await loadFontAsset(font, 400, "italic");
    assert.equal(
      calls.length,
      before + 1,
      "A failed load must not poison the cache",
    );
    const version = {
      ...font,
      variants: font.variants.map((v) => ({
        ...v,
        src: v.src.replace(".ttf", "-v2.ttf"),
      })),
    };
    assert.notEqual(
      fontFaceName(font, 400, "normal"),
      fontFaceName(version, 400, "normal"),
    );
    fail = true;
    await assert.rejects(
      validateFontFile(new File(["invalid"], "broken.ttf")),
      /valid font/,
    );
    await assert.rejects(
      validateFontFile(new File(["invalid"], "image.png")),
      /TTF/,
    );
  } finally {
    if (originalFace)
      Object.defineProperty(globalThis, "FontFace", originalFace);
    else Reflect.deleteProperty(globalThis, "FontFace");
    if (originalDocument)
      Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
