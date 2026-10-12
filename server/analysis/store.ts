import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  AnalysisEntrySchema,
  AssetAnalysisSchema,
  type AnalysisEntry,
  type AssetAnalysis,
} from "../../src/asset-analysis";
import { mediaPath } from "../../src/media";

/**
 * Sidecars keyed by content hash (`analysis/<sha256>.json`) survive renames and
 * relinks; `analysis/index.json` maps each media src to its hash and status.
 */
export class AnalysisStore {
  private queue = Promise.resolve();
  readonly directory: string;
  constructor(workspace: string) {
    this.directory = path.join(workspace, "analysis");
  }
  private async atomic(file: string, data: unknown) {
    await mkdir(this.directory, { recursive: true });
    const temp = path.join(this.directory, `.${randomUUID()}.tmp`);
    await writeFile(temp, JSON.stringify(data));
    await rename(temp, file);
  }
  private async readIndex(): Promise<Record<string, AnalysisEntry>> {
    try {
      const raw = JSON.parse(
        await readFile(path.join(this.directory, "index.json"), "utf8"),
      ) as Record<string, unknown>;
      const entries: Record<string, AnalysisEntry> = {};
      for (const [src, value] of Object.entries(raw)) {
        const parsed = AnalysisEntrySchema.safeParse(value);
        if (mediaPath.test(src) && parsed.success) entries[src] = parsed.data;
      }
      return entries;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw e;
    }
  }
  async index() {
    await this.queue;
    return this.readIndex();
  }
  async entry(src: string): Promise<AnalysisEntry> {
    return (await this.index())[src] ?? { status: "none" };
  }
  /** Serialized read-modify-write so concurrent workers never lose updates. */
  setEntry(src: string, change: (previous: AnalysisEntry) => AnalysisEntry) {
    if (!mediaPath.test(src))
      return Promise.reject(new Error("Invalid media path"));
    const operation = this.queue.then(async () => {
      const entries = await this.readIndex();
      const next = AnalysisEntrySchema.parse(
        change(entries[src] ?? { status: "none" }),
      );
      entries[src] = next;
      await this.atomic(path.join(this.directory, "index.json"), entries);
      return next;
    });
    this.queue = operation.then(
      () => {},
      () => {},
    );
    return operation;
  }
  async read(sha256: string): Promise<AssetAnalysis | null> {
    if (!/^[a-f0-9]{64}$/.test(sha256)) return null;
    try {
      return AssetAnalysisSchema.parse(
        JSON.parse(
          await readFile(path.join(this.directory, `${sha256}.json`), "utf8"),
        ),
      );
    } catch {
      return null;
    }
  }
  async write(analysis: AssetAnalysis) {
    const valid = AssetAnalysisSchema.parse(analysis);
    await this.atomic(path.join(this.directory, `${valid.sha256}.json`), valid);
  }
}
