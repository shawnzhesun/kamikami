import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  FontAssetSchema,
  resolveFont,
  fontVariant,
  type FontAsset,
  type AvailableFont,
} from "../src/font-assets";
import type { Project } from "../src/model";
import { readFontMetadata } from "./font-metadata";

export const MAX_FONT_BYTES = 20 * 1024 * 1024;
export class FontLibrary {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private data: string,
    private publicDir: string,
  ) {}

  private async read(): Promise<FontAsset[]> {
    try {
      const fonts = z
        .array(FontAssetSchema)
        .max(1000)
        .parse(
          JSON.parse(
            await readFile(path.join(this.data, "fonts.json"), "utf8"),
          ),
        );
      if (
        fonts.some(
          (f) =>
            !f.id.startsWith("custom-") ||
            f.variants.some(
              (v) =>
                !/^\/fonts\/imported\/[a-f0-9]{64}\.(ttf|otf|woff|woff2)$/.test(
                  v.src,
                ),
            ),
        )
      )
        throw new Error("Invalid imported font catalog");
      return fonts;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  }
  private file(src: string) {
    return src.startsWith("/fonts/builtin/")
      ? path.join(this.publicDir, "fonts/builtin", path.basename(src))
      : path.join(this.data, "fonts", path.basename(src));
  }
  async list(): Promise<AvailableFont[]> {
    await this.queue;
    return Promise.all(
      (await this.read()).map(async (font) => ({
        ...font,
        missing: (
          await Promise.all(
            font.variants.map((v) =>
              stat(this.file(v.src)).then(
                () => false,
                () => true,
              ),
            ),
          )
        ).some(Boolean),
      })),
    );
  }
  import(bytes: Buffer, filename: string): Promise<FontAsset> {
    const task = this.queue.then(async () => {
      if (!bytes.length || bytes.length > MAX_FONT_BYTES)
        throw new Error("Fonts must be between 1 byte and 20 MB");
      const ext = path.extname(filename).toLowerCase();
      if (![".ttf", ".otf", ".woff", ".woff2"].includes(ext))
        throw new Error("Import TTF, OTF, WOFF, or WOFF2 fonts");
      const signature = bytes.toString("ascii", 0, 4);
      if (
        (ext === ".woff" && signature !== "wOFF") ||
        (ext === ".woff2" && signature !== "wOF2") ||
        ([".ttf", ".otf"].includes(ext) && ["wOFF", "wOF2"].includes(signature))
      )
        throw new Error("The font file does not match its extension");
      const metadata = readFontMetadata(bytes);
      const digest = createHash("sha256").update(bytes).digest("hex");
      const id =
        "custom-" +
        createHash("sha256")
          .update(metadata.family.normalize("NFKC").toLowerCase())
          .digest("hex")
          .slice(0, 24);
      const fonts = await this.read();
      const existing = fonts.find((f) => f.id === id);
      if (!existing && fonts.length >= 1000)
        throw new Error("The library supports up to 1,000 font families");
      const variant = {
        src: `/fonts/imported/${digest}${ext}`,
        weightMin: metadata.weightMin,
        weightMax: metadata.weightMax,
        style: metadata.style,
      };
      const variants = (existing?.variants ?? []).filter(
        (v) =>
          v.style !== variant.style ||
          v.weightMax < variant.weightMin ||
          v.weightMin > variant.weightMax,
      );
      const font = FontAssetSchema.parse({
        id,
        family: metadata.family,
        category: existing?.category ?? metadata.category,
        variants: [...variants, variant],
      });
      await mkdir(path.join(this.data, "fonts"), { recursive: true });
      // Content-addressed files preserve the faces used by older project snapshots.
      await writeFile(this.file(variant.src), bytes);
      const next = [...fonts.filter((f) => f.id !== id), font].sort((a, b) =>
        a.family.localeCompare(b.family),
      );
      const temp = path.join(this.data, `fonts-${randomUUID()}.tmp`);
      await writeFile(temp, JSON.stringify(next, null, 2));
      await rename(temp, path.join(this.data, "fonts.json"));
      return font;
    });
    this.queue = task.catch(() => {});
    return task;
  }
  async assertAvailable(project: Project) {
    for (const layer of project.layers.filter(
      (l) => l.visible && l.type === "title" && l.fontId,
    )) {
      const font = resolveFont(layer.fontId, project.fonts);
      const variant =
        font &&
        fontVariant(font, layer.fontWeight ?? 800, layer.fontStyle ?? "normal");
      if (!font || !variant)
        throw new Error(`Choose a replacement font for “${layer.name}”`);
      try {
        await stat(this.file(variant.src));
      } catch {
        throw new Error(
          `Missing font “${font.family}”. Reimport the font or choose a replacement in the Text inspector.`,
        );
      }
    }
  }
}
