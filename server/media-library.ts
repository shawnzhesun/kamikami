import { readFile, writeFile, rename, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  emptyMetadata,
  mediaType,
  mediaPath,
  MediaMetadataSchema,
  type MediaAsset,
} from "../src/media";

export class MediaLibrary {
  private queue = Promise.resolve();
  constructor(private directory: string) {}
  private async read(): Promise<MediaAsset[]> {
    try {
      return JSON.parse(
        await readFile(path.join(this.directory, "library.json"), "utf8"),
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  }
  private async write(assets: MediaAsset[]) {
    const temp = path.join(this.directory, `library-${randomUUID()}.tmp`);
    await writeFile(temp, JSON.stringify(assets, null, 2));
    await rename(temp, path.join(this.directory, "library.json"));
  }
  async list(includeDeleted = false): Promise<MediaAsset[]> {
    await this.queue;
    const assets = await this.read();
    const files = await readdir(path.join(this.directory, "media"));
    let names = new Map<string, string>();
    try {
      const project = JSON.parse(
        await readFile(path.join(this.directory, "project.json"), "utf8"),
      );
      names = new Map(
        project.layers
          .filter((l: { src: string }) => l.src)
          .map((l: { src: string; name: string }) => [l.src, l.name]),
      );
    } catch {
      /* A library can be opened before there is a project. */
    }
    for (const filename of files) {
      const src = "/media/" + filename;
      if (mediaPath.test(src) && !assets.some((a) => a.src === src))
        assets.push({
          ...emptyMetadata,
          src,
          name: names.get(src) || filename,
          type: mediaType(filename),
          size: 0,
          missing: false,
        });
    }
    return Promise.all(
      assets
        .filter((a) => includeDeleted || !a.deleted)
        .map(async (asset) => {
          if (!mediaPath.test(asset.src))
            throw new Error("Invalid media library entry");
          try {
            const info = await stat(path.join(this.directory, asset.src));
            return { ...asset, missing: false, size: info.size };
          } catch {
            return { ...asset, missing: true };
          }
        }),
    );
  }
  async setDeleted(src: string, deleted: boolean) {
    if (!mediaPath.test(src)) throw new Error("Invalid media path");
    const discovered = await this.list(true);
    const previous = discovered.find((a) => a.src === src);
    if (!previous) throw new Error("Media not found");
    const operation = this.queue.then(async () => {
      const assets = await this.read();
      const index = assets.findIndex((a) => a.src === src);
      const next = { ...(index >= 0 ? assets[index] : previous), deleted };
      if (index >= 0) assets[index] = next;
      else assets.push(next);
      await this.write(assets);
      return next;
    });
    this.queue = operation.then(
      () => {},
      () => {},
    );
    return operation;
  }
  async register(filename: string, name: string, size: number) {
    const asset: MediaAsset = {
      ...emptyMetadata,
      src: "/media/" + filename,
      name,
      size,
      type: mediaType(filename),
      missing: false,
    };
    const operation = this.queue.then(async () => {
      const assets = await this.read();
      assets.push(asset);
      await this.write(assets);
    });
    this.queue = operation.catch(() => {});
    await operation;
    return asset;
  }
  async replaceMissing(src: string, replacement: string) {
    if (!mediaPath.test(src) || !mediaPath.test(replacement))
      throw new Error("Invalid media path");
    const discovered = await this.list();
    const old = discovered.find((a) => a.src === src),
      next = discovered.find((a) => a.src === replacement);
    if (!next || next.missing) throw new Error("Replacement media not found");
    if (old && !old.missing)
      throw new Error("Only missing sources can be replaced");
    if (old && old.type !== next.type)
      throw new Error("Replacement media type must match");
    const operation = this.queue.then(async () => {
      const assets = await this.read();
      await this.write(assets.filter((a) => a.src !== src));
    });
    this.queue = operation.catch(() => {});
    await operation;
  }
  async update(src: string, input: unknown) {
    if (!mediaPath.test(src)) throw new Error("Invalid media path");
    const metadata = MediaMetadataSchema.parse(input);
    // Discover legacy media before entering the write queue.
    const discovered = await this.list();
    const operation = this.queue.then(async () => {
      const assets = await this.read();
      const index = assets.findIndex((a) => a.src === src);
      const previous =
        index >= 0 ? assets[index] : discovered.find((a) => a.src === src);
      if (!previous) throw new Error("Media not found");
      const next = { ...previous, ...metadata };
      if (index >= 0) assets[index] = next;
      else assets.push(next);
      await this.write(assets);
      return next;
    });
    this.queue = operation.then(
      () => {},
      () => {},
    );
    return operation;
  }
}
