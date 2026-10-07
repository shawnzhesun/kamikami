/** Snap first, then clamp: fractional clip lengths must never overrun the end. */
export function movedClipStart(
  start: number,
  delta: number,
  duration: number,
  projectDuration: number,
  fps: number,
) {
  return Math.max(
    0,
    Math.min(
      projectDuration - duration,
      Math.round((start + delta) * fps) / fps,
    ),
  );
}

export function validateNumericDraft(
  draft: string,
  min: number,
  max: number,
): { value: number; error?: never } | { value?: never; error: string } {
  const value = Number(draft);
  if (draft.trim() === "" || !Number.isFinite(value))
    return { error: "Enter a number." };
  if (value < min || value > max) {
    return {
      error:
        min === max
          ? `The only available value is ${Number(min.toFixed(3))}. Adjust the clip length to make room.`
          : `Enter a value between ${Number(min.toFixed(3))} and ${Number(max.toFixed(3))}.`,
    };
  }
  return { value };
}

import type { Project } from "./model";

/** The caller must explicitly confirm any affected clips before using this result. */
export function durationChange(project: Project, duration: number) {
  const affected = project.layers.filter(
    (l) => l.start + l.duration > duration,
  );
  const next: Project = {
    ...project,
    duration,
    layers: project.layers.map((l) => {
      if (l.start + l.duration <= duration) return l;
      const start = Math.min(l.start, duration - 0.1);
      return { ...l, start, duration: Math.max(0.1, duration - start) };
    }),
  };
  return { affected, next };
}
