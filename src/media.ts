import { usesSpatialMotion } from "./motion";
import type { AnalysisEntry } from "./asset-analysis";
import {
  engineAtLeast,
  usesV6Features,
  usesV7Features,
} from "./visual-effects";
import { z } from "zod";

export const mediaPath =
  /^\/media\/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp|gif|mp4|webm|mov|mp3|wav|m4a|ogg)$/i;
export const MediaMetadataSchema = z.object({
  duration: z.number().positive().max(36000).nullable(),
  width: z.number().positive().max(100000).nullable(),
  height: z.number().positive().max(100000).nullable(),
  peaks: z.array(z.number().min(0).max(1)).max(256),
});
export type MediaMetadata = z.infer<typeof MediaMetadataSchema>;
export type MediaAsset = MediaMetadata & {
  src: string;
  name: string;
  type: "image" | "video" | "audio";
  size: number;
  missing: boolean;
  deleted?: boolean;
  /** Analysis status from the local service (see asset-analysis.ts). */
  analysis?: AnalysisEntry;
};
export const mediaType = (name: string): MediaAsset["type"] =>
  /\.(mp3|wav|m4a|ogg)$/i.test(name)
    ? "audio"
    : /\.(mp4|webm|mov)$/i.test(name)
      ? "video"
      : "image";
export const emptyMetadata: MediaMetadata = {
  duration: null,
  width: null,
  height: null,
  peaks: [],
};

export async function api(url: string, method = "GET", body?: unknown) {
  const needsEffectLibrary =
    url === "/api/effects" || url.startsWith("/api/effects/");
  const effectsRestartMessage =
    "The local effects service is outdated. Restart KamiKami with npm run desktop to load effect deletion and library persistence.";
  // Check before writing: older services silently remove unknown effect fields.
  const payload = body as
    | {
        version?: number;
        project?: {
          version?: number;
          effects?: unknown[];
          layers?: { effects?: { settings?: unknown }[] }[];
        };
        layers?: { effects?: { settings?: unknown }[] }[];
        effects?: unknown[];
        effect?: unknown;
      }
    | undefined;
  const project = payload?.project ?? payload;
  const needsInstanceSupport = project?.version === 2 || project?.version === 3;
  const needsKeyframes = project?.version === 3;
  const needsShapes = !!project?.layers?.some(
    (layer) => (layer as { type?: string }).type === "shape",
  );
  const definitions = Array.isArray(body)
    ? body
    : (project?.effects ?? (payload?.effect ? [payload.effect] : []));
  const needsMotionEngine =
    definitions.some(usesSpatialMotion) ||
    project?.layers?.some((layer) =>
      layer.effects?.some((instance) => usesSpatialMotion(instance.settings)),
    );
  const instanceSettings =
    project?.layers?.flatMap((layer) =>
      (layer.effects ?? []).map((instance) => instance.settings),
    ) ?? [];
  const needsV7Engine = [...definitions, ...instanceSettings].some(
    usesV7Features,
  );
  const needsV6Engine = [...definitions, ...instanceSettings].some(
    usesV6Features,
  );
  const needsTextEngine = [...definitions, ...instanceSettings].some(
    (definition) => {
      const effect = definition as {
        text?: unknown;
        passes?: { kind?: string }[];
      } | null;
      return (
        !!effect?.text || effect?.passes?.some((pass) => pass.kind === "blinds")
      );
    },
  );
  if (
    needsEffectLibrary ||
    (method !== "GET" &&
      (needsTextEngine ||
        needsInstanceSupport ||
        needsKeyframes ||
        needsShapes ||
        needsV6Engine ||
        needsV7Engine ||
        needsMotionEngine))
  ) {
    const health = await api("/api/health");
    if (needsEffectLibrary && health.effectLibraryVersion !== 2)
      throw new Error(effectsRestartMessage);
    if (needsInstanceSupport && !(health.projectVersion >= 2))
      throw new Error(
        "The local service is outdated. Restart KamiKami's development process before saving independent effect settings.",
      );
    if (
      needsV7Engine &&
      !engineAtLeast(health.effectEngine, "kamikami-visual-v7")
    )
      throw new Error(
        "The local service is outdated. Restart KamiKami with npm run desktop before saving or rendering the new title effects.",
      );
    if (
      needsV6Engine &&
      !engineAtLeast(health.effectEngine, "kamikami-visual-v6")
    )
      throw new Error(
        "The local service is outdated. Restart KamiKami with npm run desktop before saving or rendering spring, illustration and 3D-look effects.",
      );
    if (needsShapes && !health.elementTypes?.includes("shape"))
      throw new Error(
        "The local service is outdated. Restart KamiKami with npm run desktop before saving or rendering shapes.",
      );
    if (needsKeyframes && !(health.projectVersion >= 3))
      throw new Error(
        "The local service is outdated. Restart KamiKami with npm run desktop before saving keyframed animation.",
      );
    if (
      needsMotionEngine &&
      !engineAtLeast(health.effectEngine, "kamikami-visual-v5")
    )
      throw new Error(
        "The local service is outdated. Restart KamiKami with npm run desktop before saving or rendering spatial motion and text glitch effects.",
      );
    if (
      needsTextEngine &&
      !engineAtLeast(health.effectEngine, "kamikami-visual-v4")
    ) {
      throw new Error(
        "The local service is outdated. Restart KamiKami's development process before saving or exporting text effects.",
      );
    }
  }
  const r = await fetch(url, {
    method,
    headers: {
      "X-KamiKami": "editor",
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body:
      body instanceof FormData
        ? body
        : body === undefined
          ? undefined
          : JSON.stringify(body),
  });
  const text = await r.text();
  if (r.status === 404 && url === "/api/effects/delete")
    throw new Error(effectsRestartMessage);
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(
      `Local service returned ${r.status}. Check that the KamiKami server is running.`,
    );
  }
  if (!r.ok) throw new Error(result.error || "Request failed");
  return result;
}

export async function inspectMedia(
  file: File,
  src: string,
): Promise<MediaMetadata> {
  const type = mediaType(file.name);
  const metadata = { ...emptyMetadata };
  if (type === "image") {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        img.src = "";
        reject(new Error("Image preview timed out."));
      }, 10000);
      img.onload = () => {
        clearTimeout(timer);
        metadata.width = img.naturalWidth;
        metadata.height = img.naturalHeight;
        resolve();
      };
      img.onerror = () => {
        clearTimeout(timer);
        reject(new Error("This image format could not be previewed."));
      };
      img.src = src;
    });
  } else {
    const media = document.createElement(type);
    await new Promise<void>((resolve, reject) => {
      const done = () => {
        media.removeAttribute("src");
        media.load();
      };
      const timer = setTimeout(() => {
        done();
        reject(
          new Error("Media preview timed out. Try a browser-compatible codec."),
        );
      }, 10000);
      media.onloadedmetadata = () => {
        clearTimeout(timer);
        if (Number.isFinite(media.duration) && media.duration > 0)
          metadata.duration = media.duration;
        if (media instanceof HTMLVideoElement) {
          metadata.width = media.videoWidth || null;
          metadata.height = media.videoHeight || null;
        }
        done();
        resolve();
      };
      media.onerror = () => {
        clearTimeout(timer);
        done();
        reject(new Error("Media codec is not supported for preview."));
      };
      media.preload = "metadata";
      media.src = src;
    });
    // Bound decoding memory. Larger sources still get metadata and remain usable.
    if (
      file.size <= 32 * 1024 * 1024 &&
      (metadata.duration ?? Infinity) <= 600
    ) {
      const context = new OfflineAudioContext(1, 1, 22050);
      try {
        const buffer = await context.decodeAudioData(await file.arrayBuffer());
        const samples = buffer.getChannelData(0);
        metadata.peaks = Array.from({ length: 200 }, (_, i) => {
          const start = Math.floor((i * samples.length) / 200),
            end = Math.floor(((i + 1) * samples.length) / 200);
          let peak = 0;
          for (let j = start; j < end; j++)
            peak = Math.max(peak, Math.abs(samples[j]));
          return Math.min(1, peak);
        });
      } catch {
        /* Silent videos and unsupported audio decoders have no waveform. */
      }
    }
  }
  return metadata;
}

export const MEDIA_DRAG_TYPE = "application/x-kamikami-media";
