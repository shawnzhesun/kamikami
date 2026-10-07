import { layerAtTime, type Layer, type Project } from "../model";

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
      return {
        ...l,
        duration: newEnd - l.start,
        effectDuration: l.effectDuration || l.duration,
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
  if (project.layers.length + splittable.length > 40)
    throw new Error("Splitting would exceed the 40-layer limit.");
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
export function translateLayers(
  project: Project,
  ids: string[],
  dx: number,
  dy: number,
) {
  const selected = project.layers.filter(
    (l) => ids.includes(l.id) && l.type !== "audio",
  );
  if (!selected.length) return project;
  const x = clamp(
    dx,
    Math.max(...selected.map((l) => -1920 - l.x)),
    Math.min(...selected.map((l) => 1920 - l.x)),
  );
  const y = clamp(
    dy,
    Math.max(...selected.map((l) => -1080 - l.y)),
    Math.min(...selected.map((l) => 1080 - l.y)),
  );
  return {
    ...project,
    layers: project.layers.map((l) =>
      selected.includes(l) ? { ...l, x: l.x + x, y: l.y + y } : l,
    ),
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
  );
  return {
    ...size,
    cx: project.width / 2 + v.x,
    cy: project.height / 2 + v.y,
    rotation: v.rotation,
    scale: v.scale,
  };
}
export function hitBounds(x: number, y: number, box: Bounds) {
  const angle = (-box.rotation * Math.PI) / 180;
  const dx = x - box.cx,
    dy = y - box.cy;
  const localX = (dx * Math.cos(angle) - dy * Math.sin(angle)) / box.scale;
  const localY = (dx * Math.sin(angle) + dy * Math.cos(angle)) / box.scale;
  return (
    Math.abs(localX) <= box.width / 2 && Math.abs(localY) <= box.height / 2
  );
}
