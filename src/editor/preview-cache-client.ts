import { useEffect, useMemo, useState } from "react";
import { api } from "../media";
import type { Project } from "../model";
import { chunkKeys, chunkOf, chunkRange } from "../preview-cache";

type Status = {
  ready: string[];
  drawing: string[];
  rendering: boolean;
  error: string;
  bytes: number;
  limitBytes: number;
};
export type PreviewCacheView = {
  keys: string[];
  ready: boolean[];
  drawing: boolean[];
  bytes: number;
  error: string;
};

export const cachedFrameUrl = (key: string, index: number) =>
  `/api/preview-cache/frames/${key}/${index}`;

/**
 * Keeps the service's background render pointed at the committed project and
 * the playhead, and reports which chunks are cached. Rendering pauses during
 * playback, drags and while the window is hidden, so it never slows the
 * editor down.
 */
export function usePreviewCache({
  project,
  missingSources,
  frame,
  idle,
  enabled,
}: {
  project: Project;
  missingSources: string[];
  frame: number;
  /** Not playing, dragging or previewing an uncommitted change. */
  idle: boolean;
  enabled: boolean;
}): PreviewCacheView | null {
  const missingKey = missingSources.join("\n");
  const keys = useMemo(
    () => (enabled ? chunkKeys(project, missingSources) : []),
    [project, missingKey, enabled],
  );
  const [status, setStatus] = useState<Status | null>(null);
  const [visible, setVisible] = useState(
    () => document.visibilityState === "visible",
  );
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const render = enabled && idle && visible;
  // Seeks while paused move the render to the playhead's chunk.
  const playheadChunk = render ? chunkOf(project, frame) : -1;
  useEffect(() => {
    if (!render) {
      void api("/api/preview-cache/pause", "POST", {}).catch(() => {});
      return;
    }
    // Wait for a pause in editing, so a burst of edits sends one request.
    const t = setTimeout(
      () =>
        void api("/api/preview-cache/plan", "POST", {
          project,
          missingSources,
          from: frame,
          render: true,
        })
          .then((next: Status) => Array.isArray(next.ready) && setStatus(next))
          .catch(() => {}),
      700,
    );
    return () => clearTimeout(t);
  }, [keys, render, playheadChunk]);
  // Polling keeps the service's plan alive and picks up finished chunks.
  useEffect(() => {
    if (!enabled || !idle) return;
    let last = "";
    const timer = setInterval(
      () =>
        void api("/api/preview-cache/status")
          .then((next: Status) => {
            if (!Array.isArray(next.ready)) return;
            const text = JSON.stringify(next);
            if (text !== last) setStatus(next);
            last = text;
          })
          .catch(() => {}),
      1000,
    );
    return () => clearInterval(timer);
  }, [enabled, idle]);
  return useMemo(() => {
    if (!enabled || !status) return null;
    const ready = new Set(status.ready),
      drawing = new Set(status.drawing);
    return {
      keys,
      ready: keys.map((k) => ready.has(k)),
      drawing: keys.map((k) => drawing.has(k)),
      bytes: status.bytes,
      error: status.error,
    };
  }, [enabled, status, keys]);
}

/**
 * Decoded cached frames around the playhead. Drawing a frame must be
 * synchronous, so frames are fetched and decoded ahead of playback; a frame
 * that isn't decoded yet draws live instead.
 */
export class FramePreloader {
  private frames = new Map<string, ImageBitmap | "loading">();
  constructor(private onLoad: (url: string) => void) {}
  get(url: string) {
    const bitmap = this.frames.get(url);
    return bitmap === "loading" ? undefined : bitmap;
  }
  /** Loads these URLs (nearest first) and frees every other frame. */
  want(urls: string[]) {
    const keep = new Set(urls);
    for (const [url, bitmap] of this.frames)
      if (!keep.has(url)) {
        if (bitmap !== "loading") bitmap.close();
        this.frames.delete(url);
      }
    for (const url of urls) {
      if (this.frames.has(url)) continue;
      this.frames.set(url, "loading");
      void fetch(url)
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error())))
        .then((blob) => createImageBitmap(blob))
        .then((bitmap) => {
          // Freed while loading: the playhead moved on.
          if (this.frames.get(url) !== "loading") return bitmap.close();
          this.frames.set(url, bitmap);
          this.onLoad(url);
        })
        .catch(() => this.frames.delete(url));
    }
  }
  clear() {
    this.want([]);
  }
}

/** URLs of the cached frames from `frame` on, for the preloader. */
export function upcomingFrames(
  project: Project,
  view: PreviewCacheView,
  frame: number,
  count: number,
) {
  const urls: string[] = [];
  const total = Math.round(project.duration * project.fps);
  for (
    let f = Math.max(0, frame - 1);
    f < Math.min(total, frame + count);
    f++
  ) {
    const chunk = chunkOf(project, f);
    if (view.ready[chunk])
      urls.push(
        cachedFrameUrl(view.keys[chunk], f - chunkRange(project, chunk)[0]),
      );
  }
  return urls;
}
