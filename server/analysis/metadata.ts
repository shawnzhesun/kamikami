import path from "node:path";
import { z } from "zod";
import {
  AssetMetadataSchema,
  applyMetadata,
  entrySummary,
  type ManualField,
} from "../../src/asset-analysis";
import { mediaType, type MediaAsset } from "../../src/media";
import { probeAsset, sha256File } from "./probe";
import type { AnalysisStore } from "./store";

export type MetadataResult =
  | {
      src: string;
      ok: true;
      written: ManualField[];
      cleared?: ManualField[];
      summary: string;
    }
  | { src: string; ok: false; error: string };

/**
 * Write user- or assistant-supplied metadata (descriptions, tags, scenes,
 * transcripts) without running analysis. Fields are marked manual, so later
 * automatic analysis keeps them. Unprobed assets get the free local probe first.
 */
export async function writeMetadata({
  store,
  workspace,
  assets,
  items,
  author,
}: {
  store: AnalysisStore;
  workspace: string;
  assets: MediaAsset[];
  items: unknown[];
  author: string;
}): Promise<MetadataResult[]> {
  const results: MetadataResult[] = [];
  for (const item of items) {
    const src =
      typeof (item as { src?: unknown })?.src === "string"
        ? (item as { src: string }).src
        : "";
    try {
      const asset = assets.find((a) => a.src === src && !a.deleted);
      if (!asset)
        throw new Error(
          "Not in the media library. Use a src from the library.",
        );
      if (asset.missing)
        throw new Error("The file is missing; relink it first.");
      const { src: _src, ...fields } = item as Record<string, unknown>;
      const metadata = AssetMetadataSchema.parse(fields);
      const file = path.join(workspace, src);
      const entry = await store.entry(src);
      const sha256 = entry.sha256 ?? (await sha256File(file));
      let written: ManualField[] = [];
      const analysis = await store.update(sha256, async (latest) => {
        const base =
          latest ?? (await probeAsset(file, mediaType(src), undefined, sha256));
        const result = applyMetadata(base, metadata, author);
        written = result.fields;
        return result.analysis;
      });
      await store.setEntry(src, (e) => ({
        ...e,
        sha256,
        // Running jobs report their own status; otherwise the asset is described.
        status:
          e.status === "queued" || e.status === "running"
            ? e.status
            : e.status === "partial" || e.status === "error"
              ? "partial"
              : "ready",
        tier: e.tier ?? "probe",
        updatedAt: new Date().toISOString(),
        summary: entrySummary(analysis),
      }));
      results.push({
        src,
        ok: true,
        written,
        ...(metadata.clear?.length ? { cleared: metadata.clear } : {}),
        summary: entrySummary(analysis),
      });
    } catch (error) {
      const message =
        error instanceof z.ZodError
          ? error.issues
              .slice(0, 3)
              .map((i) => `${i.path.join(".") || "metadata"}: ${i.message}`)
              .join("; ")
          : (error as Error).message;
      results.push({ src, ok: false, error: message.slice(0, 300) });
    }
  }
  return results;
}
