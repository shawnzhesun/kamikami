import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  AnalysisSettingsSchema,
  type AnalysisSettings,
} from "../../src/asset-analysis";

/** Analysis preferences; transcription and auto-transcription default to off. */
export class AnalysisSettingsStore {
  private file: string;
  private cache: AnalysisSettings | null = null;
  constructor(workspace: string) {
    this.file = path.join(workspace, "analysis", "settings.json");
  }
  async read(): Promise<AnalysisSettings> {
    if (this.cache) return this.cache;
    try {
      this.cache = AnalysisSettingsSchema.parse(
        JSON.parse(await readFile(this.file, "utf8")),
      );
    } catch {
      this.cache = AnalysisSettingsSchema.parse({});
    }
    return this.cache;
  }
  async update(patch: unknown): Promise<AnalysisSettings> {
    const next = AnalysisSettingsSchema.parse({
      ...(await this.read()),
      ...(patch && typeof patch === "object" ? patch : {}),
    });
    await mkdir(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(next, null, 2));
    await rename(temp, this.file);
    this.cache = next;
    return next;
  }
}
