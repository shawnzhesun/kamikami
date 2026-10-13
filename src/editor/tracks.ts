import {
  elementTrackId,
  projectTracks,
  validateProject,
  type Layer,
  type Project,
  type TimelineLayer,
} from "../model";
import { frameTime } from "./editing";

export function addTrack(project: Project, track: TimelineLayer): Project {
  return validateProject({
    ...project,
    tracks: [...projectTracks(project), track],
  });
}
export function updateTrack(project: Project, track: TimelineLayer): Project {
  if (!projectTracks(project).some((t) => t.id === track.id))
    throw new Error("Layer no longer exists.");
  return validateProject({
    ...project,
    tracks: projectTracks(project).map((t) => (t.id === track.id ? track : t)),
  });
}
export function deleteTrack(project: Project, id: string): Project {
  if (!projectTracks(project).some((t) => t.id === id))
    throw new Error("Layer no longer exists.");
  return validateProject({
    ...project,
    tracks: projectTracks(project).filter((t) => t.id !== id),
    layers: project.layers.filter((e) => elementTrackId(e) !== id),
  });
}
export function reorderTracks(project: Project, ids: string[]): Project {
  const tracks = projectTracks(project);
  if (
    ids.length !== tracks.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !tracks.some((t) => t.id === id))
  )
    throw new Error("Include every layer exactly once.");
  return validateProject({
    ...project,
    tracks: ids.map((id) => tracks.find((t) => t.id === id)!),
  });
}
/** Insert at the requested frame, shortening the new element to fit the available gap. */
export function insertElement(
  project: Project,
  element: Layer,
  trackId: string,
  time: number,
): Project {
  if (!projectTracks(project).some((t) => t.id === trackId))
    throw new Error("Choose an existing layer.");
  const start = Math.max(0, frameTime(time, project.fps));
  const neighbors = project.layers.filter((e) => elementTrackId(e) === trackId);
  if (
    neighbors.some(
      (e) => start >= e.start - 0.001 && start < e.start + e.duration - 0.001,
    )
  )
    throw new Error(
      "This time is occupied. Drop in an empty part of the layer.",
    );
  const end = Math.min(
    project.duration,
    ...neighbors.filter((e) => e.start >= start).map((e) => e.start),
  );
  const duration = Math.min(element.duration, end - start);
  if (duration < 0.1)
    throw new Error(
      "There is not enough room here. Choose an earlier time or another layer.",
    );
  return validateProject({
    ...project,
    layers: [...project.layers, { ...element, trackId, start, duration }],
  });
}
/** Move a selection vertically by the same number of layers, retaining its layout. */
export function moveElementsToTrack(
  project: Project,
  ids: string[],
  anchorId: string,
  targetId: string,
): Project {
  const tracks = projectTracks(project);
  const anchor = project.layers.find((e) => e.id === anchorId);
  if (!anchor) throw new Error("Element no longer exists.");
  const from = tracks.findIndex((t) => t.id === elementTrackId(anchor));
  const to = tracks.findIndex((t) => t.id === targetId);
  if (to < 0) throw new Error("Choose an existing layer.");
  const layers = project.layers.map((e) => {
    if (!ids.includes(e.id)) return e;
    const target =
      tracks[tracks.findIndex((t) => t.id === elementTrackId(e)) + to - from];
    if (!target)
      throw new Error("The selected elements do not fit on these layers.");
    return { ...e, trackId: target.id };
  });
  return validateProject({ ...project, layers });
}
/**
 * Add a full-length element (backdrops, finishes) on its own new layer: at the
 * bottom for backgrounds, on top for finishing overlays.
 */
export function addFullLengthElement(
  project: Project,
  element: Layer,
  position: "bottom" | "top",
  trackId: string = crypto.randomUUID(),
): Project {
  const track = { id: trackId, name: element.name.slice(0, 100) || "Backdrop" };
  const tracks = projectTracks(project);
  return validateProject({
    ...project,
    tracks: position === "bottom" ? [track, ...tracks] : [...tracks, track],
    layers: [
      ...project.layers,
      { ...element, trackId, start: 0, duration: project.duration },
    ],
  });
}
