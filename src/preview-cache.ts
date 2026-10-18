import { orderedElements, type Layer, type Project } from "./model";
import { effectEngines } from "./visual-effects";

/**
 * The preview render cache splits the timeline into short chunks that the
 * service renders with the export pipeline. A chunk's key covers everything
 * that draws in it, so an edit invalidates only the chunks it can change.
 * The editor and the service compute the same keys from the same project.
 */
export const CHUNK_SECONDS = 2;
/** Cached frames are drawn this many pixels on the long side at most. */
export const PREVIEW_LONG_SIDE = 1280;

export const chunkFrames = (fps: number) =>
  Math.max(1, Math.round(fps * CHUNK_SECONDS));
export const totalFrames = (project: Project) =>
  Math.round(project.duration * project.fps);
export const chunkCount = (project: Project) =>
  Math.ceil(totalFrames(project) / chunkFrames(project.fps));
/** First and last frame (inclusive) of a chunk. */
export function chunkRange(project: Project, index: number): [number, number] {
  const size = chunkFrames(project.fps);
  return [index * size, Math.min(totalFrames(project), (index + 1) * size) - 1];
}
export const chunkOf = (project: Project, frame: number) =>
  Math.floor(frame / chunkFrames(project.fps));
export const previewScale = (project: Project) =>
  Math.min(1, PREVIEW_LONG_SIDE / Math.max(project.width, project.height));

/** A 106-bit string hash (two cyrb53 lanes); collisions are negligible here. */
function hash(text: string) {
  const lane = (seed: number) => {
    let h1 = 0xdeadbeef ^ seed,
      h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 =
      Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
      Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 =
      Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
      Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0))
      .toString(16)
      .padStart(14, "0");
  };
  return lane(1) + lane(2);
}

/** Sequence bounds in frames, exactly as the composition places elements. */
function span(layer: Layer, fps: number): [number, number] {
  const from = Math.round(layer.start * fps);
  return [from, from + Math.max(1, Math.round(layer.duration * fps))];
}

/**
 * One key per chunk. It covers the frame setup, fonts, missing media and the
 * visible elements in the chunk (in drawing order) with the effects they
 * use. Audio doesn't draw, so sound edits keep the cache. Media files never
 * change in place: a relink gives the element a new source.
 */
export function chunkKeys(project: Project, missingSources: string[] = []) {
  const base = JSON.stringify([
    effectEngines.at(-1),
    project.width,
    project.height,
    project.fps,
    previewScale(project),
    project.fonts ?? [],
  ]);
  const elements = orderedElements(project)
    .filter((l) => l.visible && l.type !== "audio")
    .map((layer) => {
      const ids = new Set(layer.effects.map((i) => i.effectId));
      return {
        span: span(layer, project.fps),
        hash: hash(
          JSON.stringify([
            layer,
            project.effects.filter((e) => ids.has(e.id)),
            !!layer.src && missingSources.includes(layer.src),
          ]),
        ),
      };
    });
  return Array.from({ length: chunkCount(project) }, (_, i) => {
    const [first, last] = chunkRange(project, i);
    const parts = elements
      .filter((e) => e.span[0] <= last && e.span[1] > first)
      .map((e) => e.hash);
    return hash(`${base}|${first}|${last}|${parts.join("|")}`);
  });
}
