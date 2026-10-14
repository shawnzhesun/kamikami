import {
  LIMITS,
  elementTrackId,
  layerAtTime,
  makeLayer,
  projectTracks,
  type Layer,
  type Project,
} from "../model";
import { propertyAt, setValueAt, type KeyframeProperty } from "../keyframes";

export const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
export const frameTime = (n: number, fps: number) => Math.round(n * fps) / fps;
export function snapValue(value: number, targets: number[], threshold: number) {
  const target = targets.reduce(
    (best, n) => (Math.abs(n - value) < Math.abs(best - value) ? n : best),
    Infinity,
  );
  return Math.abs(target - value) <= threshold ? target : value;
}
export function moveClips(
  project: Project,
  ids: string[],
  delta: number,
  snap: boolean,
  threshold: number,
  playhead: number,
) {
  const selected = project.layers.filter((l) => ids.includes(l.id));
  if (!selected.length) return project;
  const min = -Math.min(...selected.map((l) => l.start));
  const max =
    project.duration - Math.max(...selected.map((l) => l.start + l.duration));
  let move = clamp(frameTime(delta, project.fps), min, max);
  if (snap) {
    const targets = [
      0,
      project.duration,
      playhead,
      ...project.layers
        .filter((l) => !ids.includes(l.id))
        .flatMap((l) => [l.start, l.start + l.duration]),
    ];
    const corrections = selected
      .flatMap((l) => [l.start, l.start + l.duration])
      .flatMap((edge) =>
        targets
          .map((target) => target - (edge + move))
          .filter((delta) => Math.abs(delta) <= threshold),
      );
    const correction = corrections.sort((a, b) => Math.abs(a) - Math.abs(b))[0];
    if (correction !== undefined)
      move = clamp(frameTime(move + correction, project.fps), min, max);
  }
  return {
    ...project,
    layers: project.layers.map((l) =>
      ids.includes(l.id) ? { ...l, start: l.start + move } : l,
    ),
  };
}
export function trimClip(
  project: Project,
  id: string,
  edge: "left" | "right",
  position: number,
  sourceDuration?: number | null,
) {
  return {
    ...project,
    layers: project.layers.map((l) => {
      if (l.id !== id) return l;
      const minLength = Math.min(
        l.duration,
        Math.ceil(0.1 * project.fps) / project.fps,
      );
      const end = l.start + l.duration;
      const timed = l.type === "video" || l.type === "audio";
      if (edge === "left") {
        const earliest = Math.max(
          0,
          l.start - l.effectOffset,
          timed ? l.start - l.offset : 0,
        );
        const start = clamp(
          frameTime(position, project.fps),
          earliest,
          end - minLength,
        );
        const delta = start - l.start;
        return {
          ...l,
          start,
          duration: end - start,
          offset: timed ? l.offset + delta : l.offset,
          effectOffset: Math.max(0, l.effectOffset + delta),
          effectDuration: l.effectDuration || l.duration,
        };
      }
      const sourceEnd =
        timed && sourceDuration
          ? l.start + sourceDuration - l.offset
          : project.duration;
      const newEnd = clamp(
        frameTime(position, project.fps),
        l.start + minLength,
        Math.max(l.start + minLength, Math.min(project.duration, sourceEnd)),
      );
      // A whole clip's exit animations (fade out, "out" timing) follow its end.
      // Split or left-trimmed pieces keep their shared timeline for continuity.
      const whole =
        l.effectOffset === 0 &&
        Math.abs((l.effectDuration || l.duration) - l.duration) < 1e-6;
      return {
        ...l,
        duration: newEnd - l.start,
        effectDuration: whole ? 0 : l.effectDuration || l.duration,
      };
    }),
  };
}
export function splitClips(
  project: Project,
  ids: string[],
  frame: number,
  makeId: () => string = () => crypto.randomUUID(),
) {
  const at = frame / project.fps;
  const splittable = project.layers.filter(
    (l) =>
      ids.includes(l.id) &&
      at - l.start >= 0.1 - 1e-8 &&
      l.start + l.duration - at >= 0.1 - 1e-8,
  );
  if (!splittable.length)
    throw new Error(
      "Place the playhead inside a selected clip, at least 3 frames from either edge.",
    );
  if (project.layers.length + splittable.length > LIMITS.elements)
    throw new Error(
      `Splitting would exceed the ${LIMITS.elements}-element limit.`,
    );
  const selected: string[] = [];
  const layers = project.layers.flatMap((l) => {
    if (!splittable.some((item) => item.id === l.id)) return [l];
    const leftLength = at - l.start;
    const rightId = makeId();
    selected.push(l.id, rightId);
    const effectDuration = l.effectDuration || l.duration;
    return [
      { ...l, duration: leftLength, effectDuration },
      {
        ...l,
        id: rightId,
        name: `${l.name.slice(0, 91)} (split)`,
        start: at,
        duration: l.duration - leftLength,
        offset: ["audio", "video"].includes(l.type)
          ? l.offset + leftLength
          : l.offset,
        effectOffset: l.effectOffset + leftLength,
        effectDuration,
      },
    ];
  });
  return { project: { ...project, layers }, selected };
}
/** Clip-local seconds for a project frame, clamped inside the clip. */
export function localTimeAt(layer: Layer, frame: number, fps: number) {
  return clamp(
    (frame - Math.round(layer.start * fps)) / fps,
    0,
    Math.max(0, layer.duration - 1 / fps),
  );
}
/** Set a transform property at the playhead; animated properties receive a keyframe. */
export function setLayerProperty(
  layer: Layer,
  property: KeyframeProperty,
  value: number,
  frame: number | undefined,
  fps: number,
) {
  return frame === undefined
    ? { ...layer, [property]: value }
    : setValueAt(
        layer,
        { kind: "property", property },
        value,
        localTimeAt(layer, frame, fps),
      );
}
export function layerPropertyAt(
  layer: Layer,
  property: KeyframeProperty,
  frame: number | undefined,
  fps: number,
) {
  return frame === undefined
    ? layer[property]
    : propertyAt(layer, property, localTimeAt(layer, frame, fps));
}
export function translateLayers(
  project: Project,
  ids: string[],
  dx: number,
  dy: number,
  frame?: number,
) {
  const selected = project.layers.filter(
    (l) => ids.includes(l.id) && l.type !== "audio",
  );
  if (!selected.length) return project;
  const at = (l: Layer, p: "x" | "y") =>
    layerPropertyAt(l, p, frame, project.fps);
  const x = clamp(
    dx,
    Math.max(...selected.map((l) => -project.width - at(l, "x"))),
    Math.min(...selected.map((l) => project.width - at(l, "x"))),
  );
  const y = clamp(
    dy,
    Math.max(...selected.map((l) => -project.height - at(l, "y"))),
    Math.min(...selected.map((l) => project.height - at(l, "y"))),
  );
  return {
    ...project,
    layers: project.layers.map((l) => {
      if (!selected.includes(l)) return l;
      let next = l;
      if (x)
        next = setLayerProperty(next, "x", at(l, "x") + x, frame, project.fps);
      if (y)
        next = setLayerProperty(next, "y", at(l, "y") + y, frame, project.fps);
      return next;
    }),
  };
}
export function visibleAt(layer: Layer, frame: number, fps: number) {
  return (
    layer.visible &&
    layer.type !== "audio" &&
    frame >= Math.round(layer.start * fps) &&
    frame < Math.round(layer.start * fps) + Math.round(layer.duration * fps)
  );
}
export type Bounds = {
  width: number;
  height: number;
  cx: number;
  cy: number;
  rotation: number;
  scale: number;
  rotateX?: number;
  rotateY?: number;
  perspective?: number;
  opacity?: number;
};
export function layerBounds(
  layer: Layer,
  project: Project,
  frame: number,
  size: { width: number; height: number },
): Bounds {
  const v = layerAtTime(
    layer,
    project.effects,
    Math.max(0, (frame - Math.round(layer.start * project.fps)) / project.fps),
    project,
  );
  return {
    ...size,
    cx: project.width / 2 + v.x,
    cy: project.height / 2 + v.y,
    rotation: v.rotation,
    scale: v.scale,
    rotateX: v.rotateX,
    rotateY: v.rotateY,
    perspective: v.perspective,
    opacity: v.opacity,
  };
}
export function hitBounds(x: number, y: number, box: Bounds) {
  if ((box.opacity ?? 1) <= 0.001 || box.scale <= 0) return false;
  const angle = (-box.rotation * Math.PI) / 180;
  const dx = x - box.cx,
    dy = y - box.cy;
  const projectedX = (dx * Math.cos(angle) - dy * Math.sin(angle)) / box.scale;
  const projectedY = (dx * Math.sin(angle) + dy * Math.cos(angle)) / box.scale;
  // Invert the same perspective · rotateX · rotateY plane used by Composition.
  const rx = ((box.rotateX ?? 0) * Math.PI) / 180;
  const ry = ((box.rotateY ?? 0) * Math.PI) / 180;
  const cx = Math.cos(rx),
    sx = Math.sin(rx),
    cy = Math.cos(ry),
    sy = Math.sin(ry);
  const distance = box.perspective ?? 1800;
  const a = cy - (projectedX * cx * sy) / distance;
  const b = (projectedX * sx) / distance;
  const c = sx * sy - (projectedY * cx * sy) / distance;
  const d = cx + (projectedY * sx) / distance;
  const determinant = a * d - b * c;
  if (Math.abs(determinant) < 1e-8) return false;
  const localX = (projectedX * d - b * projectedY) / determinant;
  const localY = (a * projectedY - projectedX * c) / determinant;
  if (-cx * sy * localX + sx * localY >= distance) return false;
  return (
    Math.abs(localX) <= box.width / 2 && Math.abs(localY) <= box.height / 2
  );
}

const TOLERANCE = 1e-6;
/** Merge, snap to frames and sort removal ranges (seconds on the timeline). */
export function normalizeRanges(ranges: [number, number][], fps: number) {
  const sorted = ranges
    .map(
      ([a, b]) =>
        [frameTime(Math.min(a, b), fps), frameTime(Math.max(a, b), fps)] as [
          number,
          number,
        ],
    )
    .filter(([a, b]) => b - a > TOLERANCE)
    .sort((x, y) => x[0] - y[0]);
  const merged: [number, number][] = [];
  for (const r of sorted) {
    const last = merged.at(-1);
    if (last && r[0] <= last[1] + TOLERANCE) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  return merged;
}

const timed = (l: Layer) => l.type === "video" || l.type === "audio";
/** Remove [a, b) from one element's timeline, returning the surviving pieces. */
function cutElement(
  l: Layer,
  a: number,
  b: number,
  makeId: () => string,
  fps: number,
): Layer[] {
  const end = l.start + l.duration;
  const d = b - a;
  if (end <= a + TOLERANCE) return [l];
  if (l.start >= b - TOLERANCE)
    return [{ ...l, start: frameTime(l.start - d, fps) }];
  const effectDuration = l.effectDuration || l.duration;
  const minimum = 1 / fps - TOLERANCE;
  const pieces: Layer[] = [];
  if (l.start < a - TOLERANCE) {
    const left = {
      ...l,
      duration: frameTime(a - l.start, fps),
      effectDuration,
    };
    if (left.duration >= minimum) pieces.push(left);
  }
  if (end > b + TOLERANCE) {
    const skipped = b - l.start;
    const right: Layer = {
      ...l,
      ...(pieces.length
        ? { id: makeId(), name: `${l.name.slice(0, 91)} (cut)` }
        : {}),
      start: frameTime(a, fps),
      duration: frameTime(end - b, fps),
      offset: timed(l) ? l.offset + skipped : l.offset,
      effectOffset: l.effectOffset + skipped,
      effectDuration,
    };
    if (right.duration >= minimum) pieces.push(right);
  }
  return pieces;
}

/**
 * Ripple delete: remove timeline ranges and close the gaps. Elements inside a
 * range disappear, elements crossing an edge are trimmed or split (keeping
 * source, effect and keyframe continuity), and everything after moves left.
 * Without trackIds every layer ripples, keeping picture and sound in sync.
 */
export function rippleDelete(
  project: Project,
  ranges: [number, number][],
  trackIds?: string[],
  makeId: () => string = () => crypto.randomUUID(),
) {
  const fps = project.fps;
  const list = normalizeRanges(ranges, fps).reverse();
  let layers = project.layers;
  const affects = (l: Layer) =>
    !trackIds || trackIds.includes(elementTrackId(l));
  for (const [a, b] of list)
    layers = layers.flatMap((l) =>
      affects(l) ? cutElement(l, a, b, makeId, fps) : [l],
    );
  if (layers.length > LIMITS.elements)
    throw new Error(
      `This edit would exceed the ${LIMITS.elements}-element limit.`,
    );
  const removed = list.reduce((sum, [a, b]) => sum + (b - a), 0);
  const end = Math.max(0, ...layers.map((l) => l.start + l.duration));
  const duration = trackIds
    ? project.duration
    : Math.max(1, end, frameTime(project.duration - removed, fps));
  return { ...project, duration: Math.min(project.duration, duration), layers };
}

/** Ripple-delete selected clips: each clip's span closes on its own layer only. */
export function rippleDeleteElements(project: Project, ids: string[]) {
  const targets = project.layers.filter((l) => ids.includes(l.id));
  let next: Project = {
    ...project,
    layers: project.layers.filter((l) => !ids.includes(l.id)),
  };
  // Latest first, so earlier spans keep their positions.
  for (const t of [...targets].sort((x, y) => y.start - x.start))
    next = rippleDelete(
      next,
      [[t.start, t.start + t.duration]],
      [elementTrackId(t)],
    );
  return next;
}

/** Ripple insert: open a gap at `at`, splitting elements that span it. */
export function rippleInsert(
  project: Project,
  at: number,
  length: number,
  trackIds?: string[],
  makeId: () => string = () => crypto.randomUUID(),
) {
  const fps = project.fps;
  const t = frameTime(at, fps),
    d = frameTime(length, fps);
  if (d <= 0) return project;
  const affects = (l: Layer) =>
    !trackIds || trackIds.includes(elementTrackId(l));
  const layers = project.layers.flatMap((l) => {
    if (!affects(l) || l.start + l.duration <= t + TOLERANCE) return [l];
    if (l.start >= t - TOLERANCE)
      return [{ ...l, start: frameTime(l.start + d, fps) }];
    const effectDuration = l.effectDuration || l.duration;
    const head = t - l.start;
    return [
      { ...l, duration: frameTime(head, fps), effectDuration },
      {
        ...l,
        id: makeId(),
        name: `${l.name.slice(0, 91)} (split)`,
        start: frameTime(t + d, fps),
        duration: frameTime(l.duration - head, fps),
        offset: timed(l) ? l.offset + head : l.offset,
        effectOffset: l.effectOffset + head,
        effectDuration,
      },
    ];
  });
  const end = Math.max(0, ...layers.map((l) => l.start + l.duration));
  if (end > LIMITS.seconds)
    throw new Error(`Projects are limited to ${LIMITS.seconds / 60} minutes.`);
  return {
    ...project,
    duration: Math.max(
      project.duration,
      end,
      project.duration + (trackIds ? 0 : d),
    ),
    layers,
  };
}

/** Remove ranges given in a clip's source seconds (e.g. silences, filler words). */
export function cutSourceRanges(
  project: Project,
  layerId: string,
  ranges: [number, number][],
  scope: "all" | "track" = "all",
) {
  const l = project.layers.find((x) => x.id === layerId);
  if (!l) throw new Error("Element not found.");
  const base = timed(l) ? l.offset : l.effectOffset;
  const timeline = ranges
    .map(
      ([a, b]) =>
        [l.start + (a - base), l.start + (b - base)] as [number, number],
    )
    .map(
      ([a, b]) =>
        [Math.max(l.start, a), Math.min(l.start + l.duration, b)] as [
          number,
          number,
        ],
    )
    .filter(([a, b]) => b > a);
  return rippleDelete(
    project,
    timeline,
    scope === "track" ? [elementTrackId(l)] : undefined,
  );
}

export type EditRange = {
  src: string;
  start: number;
  end: number;
  name?: string;
};
/**
 * Assemble source ranges back to back on one layer, the EDL step of
 * transcript-driven editing. One call = one undo step.
 */
export function applyEditList(
  project: Project,
  ranges: EditRange[],
  assets: {
    src: string;
    name: string;
    type: Layer["type"];
    duration: number | null;
  }[],
  {
    trackId,
    at = 0,
    replace = false,
    makeId = () => crypto.randomUUID(),
  }: {
    trackId?: string;
    at?: number;
    replace?: boolean;
    makeId?: () => string;
  } = {},
) {
  const fps = project.fps;
  if (!ranges.length) throw new Error("Provide at least one range.");
  const tracks = [...projectTracks(project)];
  let target = trackId;
  if (!target) {
    target = `track-${makeId()}`.slice(0, 100);
    if (tracks.length >= LIMITS.tracks)
      throw new Error("No room for a new layer.");
    tracks.push({ id: target, name: "Edit" });
  } else if (!tracks.some((t) => t.id === target))
    throw new Error("Unknown layer.");
  let cursor = frameTime(at, fps);
  const placed: Layer[] = [];
  for (const r of ranges) {
    const asset = assets.find((a) => a.src === r.src);
    if (!asset) throw new Error(`Media not found: ${r.src}`);
    if (asset.type === "image" && !(r.end > r.start))
      throw new Error("Image ranges need a length.");
    const start = frameTime(Math.max(0, r.start), fps);
    const end = frameTime(
      asset.duration ? Math.min(asset.duration, r.end) : r.end,
      fps,
    );
    if (end - start < 1 / fps - TOLERANCE) continue;
    placed.push({
      ...makeLayer(asset.type, (r.name ?? asset.name).slice(0, 100)),
      id: makeId(),
      trackId: target,
      src: asset.src,
      start: cursor,
      duration: end - start,
      offset: asset.type === "image" ? 0 : start,
    });
    cursor = frameTime(cursor + end - start, fps);
  }
  const kept = project.layers.filter(
    (l) =>
      elementTrackId(l) !== target ||
      (!replace &&
        (l.start + l.duration <= at + TOLERANCE ||
          l.start >= cursor - TOLERANCE)),
  );
  if (!replace && kept.length !== project.layers.length)
    throw new Error(
      "The edit overlaps existing clips on that layer. Use replace or another layer.",
    );
  const layers = [...kept, ...placed];
  if (layers.length > LIMITS.elements)
    throw new Error(
      `This edit would exceed the ${LIMITS.elements}-element limit.`,
    );
  if (cursor > LIMITS.seconds)
    throw new Error(`Projects are limited to ${LIMITS.seconds / 60} minutes.`);
  return {
    project: {
      ...project,
      tracks,
      duration: Math.max(project.duration, cursor),
      layers,
    },
    trackId: target,
    layerIds: placed.map((l) => l.id),
  };
}

/**
 * Crossfade two adjacent clips: extend one into the other using spare source
 * footage, move the overlapping clip to a free layer and fade both.
 */
export function crossfade(
  project: Project,
  fromId: string,
  toId: string,
  seconds: number,
  sourceDuration: (src: string) => number | null,
) {
  const fps = project.fps;
  const s = frameTime(seconds, fps);
  const a = project.layers.find((l) => l.id === fromId);
  const b = project.layers.find((l) => l.id === toId);
  if (!a || !b) throw new Error("Element not found.");
  if (Math.abs(a.start + a.duration - b.start) > 1 / fps)
    throw new Error(
      "Crossfades need the second clip to start where the first ends.",
    );
  let first = a,
    second = b;
  const headroom = timed(b) ? b.offset : Infinity;
  const tail = timed(a)
    ? (sourceDuration(a.src) ?? 0) - (a.offset + a.duration)
    : Infinity;
  if (headroom >= s - TOLERANCE)
    second = {
      ...b,
      start: b.start - s,
      duration: b.duration + s,
      offset: timed(b) ? b.offset - s : b.offset,
      effectOffset: Math.max(0, b.effectOffset - s),
    };
  else if (tail >= s - TOLERANCE)
    first = {
      ...a,
      duration: a.duration + s,
      effectDuration: a.effectDuration || a.duration,
    };
  else
    throw new Error(
      "Neither clip has enough extra source footage for this crossfade.",
    );
  first = { ...first, fadeOut: s };
  second = { ...second, fadeIn: s };
  // The overlapping clip needs a layer that is free during the overlap.
  const span: [number, number] = [second.start, second.start + second.duration];
  const tracks = [...projectTracks(project)];
  const index = tracks.findIndex((t) => t.id === elementTrackId(second));
  const free = (trackId: string) =>
    !project.layers.some(
      (l) =>
        l.id !== b.id &&
        l.id !== a.id &&
        elementTrackId(l) === trackId &&
        l.start < span[1] - TOLERANCE &&
        l.start + l.duration > span[0] + TOLERANCE,
    );
  // Only the picture track right above will do: moving a clip onto a row of
  // titles or shapes, or past them, would mix up the user's tracks.
  const pictures = (trackId: string) =>
    project.layers.every(
      (l) =>
        elementTrackId(l) !== trackId ||
        l.type === "video" ||
        l.type === "image",
    );
  const above = tracks[index + 1]?.id;
  let trackId = above && free(above) && pictures(above) ? above : undefined;
  if (!trackId) {
    if (tracks.length >= LIMITS.tracks)
      throw new Error("No room for a crossfade layer.");
    trackId = `track-${crypto.randomUUID()}`.slice(0, 100);
    tracks.splice(index + 1, 0, { id: trackId, name: "Crossfades" });
  }
  second = { ...second, trackId };
  return {
    ...project,
    tracks,
    layers: project.layers.map((l) =>
      l.id === a.id ? first : l.id === b.id ? second : l,
    ),
  };
}

/**
 * Detach a video's sound into its own audio element (for J/L cuts or picking a
 * different recorded track): same timing and source offset, video muted.
 */
export function detachAudio(
  project: Project,
  layerId: string,
  audioSrc: string,
  makeId: () => string = () => crypto.randomUUID(),
) {
  const video = project.layers.find((l) => l.id === layerId);
  if (!video || video.type !== "video")
    throw new Error("Choose a video element.");
  if (project.layers.length + 1 > LIMITS.elements)
    throw new Error(
      `This edit would exceed the ${LIMITS.elements}-element limit.`,
    );
  const tracks = [...projectTracks(project)];
  const index = tracks.findIndex((t) => t.id === elementTrackId(video));
  const free = (trackId: string) =>
    !project.layers.some(
      (l) =>
        elementTrackId(l) === trackId &&
        l.start < video.start + video.duration - TOLERANCE &&
        l.start + l.duration > video.start + TOLERANCE,
    );
  // Prefer a free layer below the video (layers are ordered bottom to top).
  let trackId = tracks
    .slice(0, index)
    .reverse()
    .find((t) => free(t.id))?.id;
  if (!trackId) {
    if (tracks.length >= LIMITS.tracks)
      throw new Error("No room for an audio layer.");
    trackId = `track-${makeId()}`.slice(0, 100);
    tracks.splice(Math.max(0, index), 0, {
      id: trackId,
      name: `${video.name.slice(0, 80)} audio`,
    });
  }
  const audio: Layer = {
    ...makeLayer("audio", `${video.name.slice(0, 90)} (audio)`),
    id: makeId(),
    trackId,
    src: audioSrc,
    start: video.start,
    duration: video.duration,
    offset: video.offset,
    volume: video.volume,
    solo: video.solo,
    ...(video.fadeIn ? { fadeIn: video.fadeIn } : {}),
    ...(video.fadeOut ? { fadeOut: video.fadeOut } : {}),
    ...(video.keyframes?.volume
      ? {
          keyframes: { volume: video.keyframes.volume },
          effectOffset: video.effectOffset,
        }
      : {}),
  };
  return {
    project: {
      ...project,
      tracks,
      layers: [
        ...project.layers.map((l) =>
          l.id === layerId ? { ...l, muted: true } : l,
        ),
        audio,
      ],
    },
    audioId: audio.id,
  };
}
