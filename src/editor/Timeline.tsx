import React, { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Layers,
  Magnet,
  Scissors,
  GripVertical,
  Plus,
  Settings2,
  DatabaseZap,
  Trash2,
} from "lucide-react";
import type { PreviewCacheView } from "./preview-cache-client";
import {
  projectTracks,
  elementTrackId,
  validateProject,
  type TimelineLayer,
  type Layer,
  type Project,
} from "../model";
import { MEDIA_DRAG_TYPE } from "../media";
import { moveElementsToTrack, reorderTracks } from "./tracks";
import type { MediaAsset } from "../media";
import { clamp, moveClips, snapValue, splitClips, trimClip } from "./editing";
import { isGestureActive, startGesture } from "./gesture";
import { Waveform } from "./Waveform";
import { ShapeMenu } from "./ShapeMenu";
import { BackdropMenu } from "./BackdropMenu";
import type { BackdropPreset } from "../backdrops";
import type { ShapePreset } from "../shapes";
import { EFFECT_DRAG_TYPE } from "../effect-bundle";
import { retimeKeyframes, visibleKeyframeTimes } from "../keyframes";
import { phaseLengths, setPhaseLength, type Phase } from "./envelope";
import { chunkFrames } from "../preview-cache";

// The sticky layer names and the right margin of every lane, in pixels.
const LABEL_WIDTH = 145,
  LANE_MARGIN = 18;
/** A ruler step of about 80 pixels: whole frames, then round seconds. */
function rulerStep(pixelsPerSecond: number, fps: number) {
  const steps = [1, 2, 4, 6, 12].map((f) => f / fps);
  steps.push(1, 2, 5, 10, 15, 30, 60, 120, 300);
  const wanted = 80 / pixelsPerSecond;
  return steps.find((s) => s >= wanted - 1e-9) ?? steps.at(-1)!;
}
function rulerLabel(seconds: number, step: number, fps: number) {
  const whole = Math.floor(seconds + 1e-6),
    frames = Math.round((seconds - whole) * fps);
  return step < 1 && frames ? `${whole}s+${frames}f` : `${whole}s`;
}

type Props = {
  project: Project;
  selected: string[];
  frame: number;
  assets: MediaAsset[];
  onSelect: (ids: string[]) => void;
  onSeek: (frame: number) => void;
  onPreview: (p: Project | null) => void;
  onCommit: (p: Project, base?: Project) => void;
  onStatus: (message: string) => void;
  onPause: () => void;
  selectedTrack: string | null;
  onSelectTrack: (id: string) => void;
  onAddLayer: () => void;
  onEditLayer: (track: TimelineLayer) => void;
  onDropMedia: (src: string, trackId: string | undefined, time: number) => void;
  onAddText: () => void;
  onAddShape: (preset: ShapePreset, color: string) => void;
  onAddBackdrop: (preset: BackdropPreset) => void;
  onApplyEffect: (effectId: string, layerId: string) => void;
  /** Cached chunks of the committed project; null while editing or off. */
  previewCache: PreviewCacheView | null;
  previewCacheOn: boolean;
  onPreviewCacheOn: (on: boolean) => void;
  onClearPreviewCache: () => void;
};
export function Timeline({
  project,
  selected,
  frame,
  assets,
  onSelect,
  onSeek,
  onPreview,
  onCommit,
  onStatus,
  onPause,
  selectedTrack,
  onSelectTrack,
  onAddLayer,
  onEditLayer,
  onDropMedia,
  onAddText,
  onAddShape,
  onAddBackdrop,
  onApplyEffect,
  previewCache,
  previewCacheOn,
  onPreviewCacheOn,
  onClearPreviewCache,
}: Props) {
  const [zoom, setZoom] = useState(1),
    [snapping, setSnapping] = useState(true),
    [drag, setDrag] = useState<{ id: string; label: string } | null>(null);
  const [mediaTarget, setMediaTarget] = useState<{
    id: string;
    time: number;
  } | null>(null);
  const tracks = projectTracks(project);
  const [effectTarget, setEffectTarget] = useState<string | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const scroller = useRef<HTMLDivElement>(null),
    contentRef = useRef<HTMLDivElement>(null);
  const ignoreClickUntil = useRef(0);
  const [rowDrop, setRowDrop] = useState<{
    id: string;
    edge: "above" | "below";
  } | null>(null);
  const [rowDragging, setRowDragging] = useState<string | null>(null);
  const [marquee, setMarquee] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  // Zoom multiplies the visible width; the deepest zoom gives about 24 pixels
  // per frame, for frame-accurate moves in long projects.
  const [viewWidth, setViewWidth] = useState(0);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setViewWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const laneWidth = (z: number) =>
    Math.max(1, z * viewWidth - LABEL_WIDTH - LANE_MARGIN);
  const maxZoom = viewWidth
    ? Math.max(
        8,
        (project.duration * project.fps * 24 + LABEL_WIDTH + LANE_MARGIN) /
          viewWidth,
      )
    : 8;
  const step = rulerStep(laneWidth(zoom) / project.duration, project.fps);
  // The timeline renders on every played frame; a deep zoom has thousands of ticks.
  const ticks = useMemo(
    () =>
      Array.from(
        { length: Math.floor(project.duration / step + 1e-6) + 1 },
        (_, i) => (
          <span
            key={i}
            style={{ left: `${((i * step) / project.duration) * 100}%` }}
          >
            {rulerLabel(i * step, step, project.fps)}
          </span>
        ),
      ),
    [step, project.duration, project.fps],
  );
  // Runs of cached (and rendering) chunks, as shares of the timeline.
  const cacheRuns = useMemo(() => {
    if (!previewCache) return [];
    const size = chunkFrames(project.fps),
      total = project.duration * project.fps;
    const runs: { from: number; to: number; drawing: boolean }[] = [];
    previewCache.keys.forEach((_, i) => {
      const drawing = previewCache.drawing[i];
      if (!previewCache.ready[i] && !drawing) return;
      const last = runs.at(-1);
      if (last && last.to === i && last.drawing === drawing) last.to = i + 1;
      else runs.push({ from: i, to: i + 1, drawing });
    });
    return runs.map((r) => ({
      left: (r.from * size) / total,
      width: (Math.min(total, r.to * size) - r.from * size) / total,
      drawing: r.drawing,
    }));
  }, [previewCache, project.fps, project.duration]);
  const cachedShare = previewCache
    ? previewCache.ready.filter(Boolean).length /
      Math.max(1, previewCache.ready.length)
    : 0;
  // When zoomed in, the view pages along with the playhead.
  useEffect(() => {
    const el = scroller.current;
    if (!el || zoom === 1 || isGestureActive()) return;
    const x =
      LABEL_WIDTH +
      (frame / project.fps / project.duration) * laneWidth(zoom) -
      el.scrollLeft;
    if (x < LABEL_WIDTH || x > el.clientWidth - LANE_MARGIN)
      el.scrollLeft += x - LABEL_WIDTH - 24;
  }, [frame]);
  /** Zooms around a point on screen, or around the playhead when it's visible. */
  function zoomTo(next: number, clientX?: number) {
    const el = scroller.current,
      z = clamp(next, 1, maxZoom);
    if (!el || z === zoom) return;
    const r = el.getBoundingClientRect();
    const playhead =
      LABEL_WIDTH +
      (frame / project.fps / project.duration) * laneWidth(zoom) -
      el.scrollLeft;
    const x =
      clientX !== undefined
        ? clientX - r.left
        : playhead >= LABEL_WIDTH && playhead <= el.clientWidth
          ? playhead
          : (LABEL_WIDTH + el.clientWidth) / 2;
    const share = (el.scrollLeft + x - LABEL_WIDTH) / laneWidth(zoom);
    // Render the new width before scrolling, so the point stays in place.
    flushSync(() => setZoom(z));
    el.scrollLeft = LABEL_WIDTH + share * laneWidth(z) - x;
  }
  const zoomBy = useRef(zoomTo),
    zoomRef = useRef(zoom);
  zoomBy.current = zoomTo;
  zoomRef.current = zoom;
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    // Pinch on a trackpad arrives as a wheel event with ctrlKey set.
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomBy.current(zoomRef.current * Math.exp(-e.deltaY * 0.01), e.clientX);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  function select(id: string, additive: boolean) {
    onSelect(
      additive
        ? selected.includes(id)
          ? selected.filter((x) => x !== id)
          : [...selected, id]
        : [id],
    );
  }
  const split = () => {
    try {
      const result = splitClips(project, selected, frame);
      onCommit(result.project);
      onSelect(result.selected);
    } catch (e) {
      onStatus((e as Error).message);
    }
  };
  function beginReorder(
    e: React.PointerEvent<HTMLElement>,
    layer: TimelineLayer,
  ) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    cleanup.current?.();
    onPause();
    const base = project,
      origin = e.clientY;
    let target: { id: string; edge: "above" | "below" } | null = null,
      moved = false;
    setRowDragging(layer.id);
    cleanup.current = startGesture(
      e,
      (event) => {
        if (!moved && Math.abs(event.clientY - origin) < 4) return;
        moved = true;
        const panel = scroller.current!;
        const rect = panel.getBoundingClientRect();
        if (event.clientY < rect.top + 28) panel.scrollTop -= 12;
        if (event.clientY > rect.bottom - 28) panel.scrollTop += 12;
        const rows = [
          ...panel.querySelectorAll<HTMLElement>("[data-track-id]"),
        ];
        const row =
          rows.find((row) => {
            const r = row.getBoundingClientRect();
            return event.clientY >= r.top && event.clientY <= r.bottom;
          }) ??
          (event.clientY < rect.top
            ? rows[0]
            : event.clientY > rect.bottom
              ? rows.at(-1)
              : undefined);
        if (row) {
          const r = row.getBoundingClientRect();
          target = {
            id: row.dataset.trackId!,
            edge: event.clientY < r.top + r.height / 2 ? "above" : "below",
          };
          setRowDrop(target);
        }
      },
      (cancelled) => {
        setRowDrop(null);
        setRowDragging(null);
        if (moved) ignoreClickUntil.current = Date.now() + 200;
        if (!cancelled && moved && target && target.id !== layer.id) {
          const order = [...projectTracks(base)]
            .reverse()
            .map((l) => l.id)
            .filter((id) => id !== layer.id);
          const at =
            order.indexOf(target.id) + (target.edge === "below" ? 1 : 0);
          order.splice(at, 0, layer.id);
          onCommit(reorderTracks(base, order.reverse()), base);
        }
        cleanup.current = null;
      },
    );
  }
  function reorderKey(e: React.KeyboardEvent, layer: TimelineLayer) {
    if (!["ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    const ids = tracks.map((l) => l.id),
      index = ids.indexOf(layer.id),
      next = index + (e.key === "ArrowUp" ? 1 : -1);
    if (next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next], ids[index]];
    onCommit(reorderTracks(project, ids));
  }
  /** Click a clip keyframe to seek; drag it to retime every key at that frame. */
  function beginKeyframe(
    e: React.PointerEvent<HTMLElement>,
    layer: Layer,
    time: number,
  ) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onPause();
    cleanup.current?.();
    const base = project,
      origin = e.clientX;
    const clip = e.currentTarget.closest<HTMLElement>(".clip")!;
    const perSecond = clip.getBoundingClientRect().width / layer.duration;
    let latest = base,
      moved = false;
    cleanup.current = startGesture(
      e,
      (event) => {
        const dx = event.clientX - origin;
        if (!moved && Math.abs(dx) < 3) return;
        moved = true;
        const to = clamp(
          Math.round((time + dx / perSecond) * project.fps) / project.fps,
          0,
          layer.duration,
        );
        setDrag({ id: layer.id, label: `Keyframe ${to.toFixed(2)}s` });
        latest = {
          ...base,
          layers: base.layers.map((l) =>
            l.id === layer.id ? retimeKeyframes(l, time, to) : l,
          ),
        };
        onPreview(latest);
      },
      (cancelled) => {
        onPreview(null);
        setDrag(null);
        if (moved) ignoreClickUntil.current = Date.now() + 200;
        if (!cancelled && moved) onCommit(latest, base);
        if (!moved && !cancelled) {
          onSelect([layer.id]);
          onSeek(
            Math.round(layer.start * project.fps) +
              Math.round(time * project.fps),
          );
        }
        cleanup.current = null;
      },
    );
  }
  /** Drags a clip's In or Out phase edge, retiming the effects in it. */
  function beginPhase(
    e: React.PointerEvent<HTMLElement>,
    layer: Layer,
    phase: Phase,
    length: number,
  ) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onPause();
    cleanup.current?.();
    const base = project,
      origin = e.clientX;
    const clip = e.currentTarget.closest<HTMLElement>(".clip")!;
    const perSecond = clip.getBoundingClientRect().width / layer.duration;
    let latest = base,
      moved = false;
    cleanup.current = startGesture(
      e,
      (event) => {
        const dx = (event.clientX - origin) * (phase === "in" ? 1 : -1);
        if (!moved && Math.abs(dx) < 3) return;
        moved = true;
        const to = Math.max(
          0.05,
          Math.round((length + dx / perSecond) * project.fps) / project.fps,
        );
        latest = setPhaseLength(base, layer.id, phase, to);
        const now = phaseLengths(
          latest.layers.find((l) => l.id === layer.id)!,
          latest.effects,
        )[phase];
        setDrag({
          id: layer.id,
          label: `${phase === "in" ? "In" : "Out"} ${(now ?? to).toFixed(2)}s`,
        });
        onPreview(latest);
      },
      (cancelled) => {
        onPreview(null);
        setDrag(null);
        if (moved) ignoreClickUntil.current = Date.now() + 200;
        if (!cancelled && moved) onCommit(latest, base);
        cleanup.current = null;
      },
    );
  }
  function phaseKey(
    e: React.KeyboardEvent<HTMLElement>,
    layer: Layer,
    phase: Phase,
    length: number,
  ) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    e.stopPropagation();
    const step =
      (e.shiftKey ? 0.1 : 1 / project.fps) *
      (e.key === "ArrowRight" ? 1 : -1) *
      (phase === "in" ? 1 : -1);
    onCommit(setPhaseLength(project, layer.id, phase, length + step));
  }
  function begin(
    e: React.PointerEvent<HTMLElement>,
    layer: Layer,
    edge?: "left" | "right",
  ) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.focus({ preventScroll: true });
    onPause();
    cleanup.current?.();
    // Shift or Cmd adds the clip to the selection and drags them together; a
    // click without a drag removes an already selected clip again.
    const additive = !edge && (e.shiftKey || e.metaKey),
      wasSelected = selected.includes(layer.id);
    const ids = edge
      ? [layer.id]
      : wasSelected
        ? selected
        : additive
          ? [...selected, layer.id]
          : [layer.id];
    onSelect(ids);
    const base = project,
      origin = e.clientX,
      originY = e.clientY;
    const lane = e.currentTarget.closest<HTMLElement>(".track-lane")!;
    const width = lane.getBoundingClientRect().width;
    const initialScroll = scroller.current?.scrollLeft ?? 0;
    let latest = base,
      moved = false,
      invalid = "";
    const start = edge === "right" ? layer.start + layer.duration : layer.start;
    const threshold = (8 / width) * project.duration;
    cleanup.current = startGesture(
      e,
      (event) => {
        const parent = scroller.current;
        if (parent) {
          const r = parent.getBoundingClientRect();
          if (event.clientX > r.right - 24) parent.scrollLeft += 12;
          if (event.clientX < r.left + 160) parent.scrollLeft -= 12;
        }
        const dx =
          event.clientX - origin + (parent?.scrollLeft ?? 0) - initialScroll;
        if (!moved && Math.hypot(dx, event.clientY - originY) < 3) return;
        moved = true;
        const delta = (dx / width) * base.duration;
        if (edge) {
          let position = start + delta;
          if (snapping && !event.altKey)
            position = snapValue(
              position,
              [
                0,
                base.duration,
                frame / base.fps,
                ...base.layers
                  .filter((l) => l.id !== layer.id)
                  .flatMap((l) => [l.start, l.start + l.duration]),
              ],
              threshold,
            );
          latest = trimClip(
            base,
            layer.id,
            edge,
            position,
            assets.find((a) => a.src === layer.src)?.duration,
          );
        } else
          latest = moveClips(
            base,
            ids,
            delta,
            snapping && !event.altKey,
            threshold,
            frame / base.fps,
          );
        const target = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest<HTMLElement>("[data-track-id]");
        try {
          latest =
            !edge && target?.dataset.trackId
              ? moveElementsToTrack(
                  latest,
                  ids,
                  layer.id,
                  target.dataset.trackId,
                )
              : validateProject(latest);
          invalid = "";
          const changed = latest.layers.find((l) => l.id === layer.id)!;
          setDrag({
            id: layer.id,
            label: `${changed.start.toFixed(2)}s – ${(changed.start + changed.duration).toFixed(2)}s`,
          });
          onPreview(latest);
        } catch (error) {
          invalid = (error as Error).message;
          setDrag({ id: layer.id, label: invalid });
          onPreview(null);
        }
      },
      (cancelled) => {
        if (moved) ignoreClickUntil.current = Date.now() + 200;
        onPreview(null);
        setDrag(null);
        if (!cancelled && moved) {
          if (invalid) onStatus(invalid);
          else onCommit(latest, base);
        }
        if (!cancelled && !moved && !edge && wasSelected)
          onSelect(
            additive ? selected.filter((id) => id !== layer.id) : [layer.id],
          );
        cleanup.current = null;
      },
    );
  }
  /**
   * Drag on empty lane space to select every clip the box touches; Shift or
   * Cmd adds them to the selection. A click without a drag still seeks.
   */
  function beginMarquee(e: React.PointerEvent<HTMLElement>) {
    if (e.button !== 0 || e.target !== e.currentTarget) return;
    const panel = scroller.current,
      content = contentRef.current;
    if (!panel || !content) return;
    cleanup.current?.();
    const at = (event: { clientX: number; clientY: number }) => {
      const r = content.getBoundingClientRect();
      return { x: event.clientX - r.left, y: event.clientY - r.top };
    };
    const origin = at(e),
      before = e.shiftKey || e.metaKey ? selected : [];
    let moved = false,
      last = { clientX: e.clientX, clientY: e.clientY },
      ids = before;
    const update = () => {
      const point = at(last);
      if (!moved && Math.hypot(point.x - origin.x, point.y - origin.y) < 4)
        return;
      if (!moved) onPause();
      moved = true;
      const box = {
        left: Math.min(origin.x, point.x),
        top: Math.min(origin.y, point.y),
        width: Math.abs(point.x - origin.x),
        height: Math.abs(point.y - origin.y),
      };
      setMarquee(box);
      const r = content.getBoundingClientRect();
      const hits = [
        ...content.querySelectorAll<HTMLElement>("[data-element-id]"),
      ]
        .filter((clip) => {
          const c = clip.getBoundingClientRect();
          return (
            c.right > r.left + box.left &&
            c.left < r.left + box.left + box.width &&
            c.bottom > r.top + box.top &&
            c.top < r.top + box.top + box.height
          );
        })
        .map((clip) => clip.dataset.elementId!);
      const next = [...before, ...hits.filter((id) => !before.includes(id))];
      if (next.join() !== ids.join()) onSelect((ids = next));
    };
    // Scrolling under a still pointer grows the box too.
    panel.addEventListener("scroll", update);
    const stop = startGesture(
      e,
      (event) => {
        last = event;
        const r = panel.getBoundingClientRect();
        if (event.clientX > r.right - 24) panel.scrollLeft += 12;
        if (event.clientX < r.left + LABEL_WIDTH + 16) panel.scrollLeft -= 12;
        if (event.clientY > r.bottom - 16) panel.scrollTop += 8;
        if (event.clientY < r.top + 40) panel.scrollTop -= 8;
        update();
      },
      (cancelled) => {
        panel.removeEventListener("scroll", update);
        setMarquee(null);
        if (cancelled && moved) onSelect(selected);
        if (moved) ignoreClickUntil.current = Date.now() + 200;
        cleanup.current = null;
      },
    );
    cleanup.current = () => {
      panel.removeEventListener("scroll", update);
      stop();
    };
  }
  function trimKey(
    e: React.KeyboardEvent,
    layer: Layer,
    edge: "left" | "right",
  ) {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    onPause();
    const delta =
      (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 1 : 1 / project.fps);
    onCommit(
      trimClip(
        project,
        layer.id,
        edge,
        layer.start + (edge === "right" ? layer.duration : 0) + delta,
        assets.find((a) => a.src === layer.src)?.duration,
      ),
    );
  }
  const seek = (e: { clientX: number }, element: HTMLElement) => {
    const r = element.getBoundingClientRect();
    onSeek(
      clamp(
        Math.round(
          ((e.clientX - r.left) / r.width) * project.duration * project.fps,
        ),
        0,
        Math.round(project.duration * project.fps) - 1,
      ),
    );
  };
  return (
    <section
      className="timeline"
      aria-label="Timeline editor"
      onClickCapture={(e) => {
        if (Date.now() < ignoreClickUntil.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <div className="timeline-heading">
        <span>
          <Layers size={14} />
          Timeline{" "}
          <span className="small-label">{selected.length} selected</span>
        </span>
        <div className="timeline-tools">
          <button onClick={onAddText} title="Add text to the selected layer">
            <Plus size={13} />
            Text
          </button>
          <ShapeMenu onAdd={onAddShape} />
          <BackdropMenu onAdd={onAddBackdrop} />
          <button
            onClick={split}
            disabled={!selected.length}
            title="Split selected clips at playhead"
          >
            <Scissors size={14} />
            Split
          </button>
          <button
            aria-label="Preview render cache"
            aria-pressed={previewCacheOn}
            onClick={() => onPreviewCacheOn(!previewCacheOn)}
            title={
              (previewCacheOn
                ? `Render cache: ${Math.round(cachedShare * 100)}% cached (${((previewCache?.bytes ?? 0) / 1024 ** 2).toFixed(0)} MB).`
                : "Render cache is off.") +
              " While you're not playing or editing, KamiKami renders the timeline with the export renderer; green ranges play back exactly as exported. The frames are deleted when KamiKami quits." +
              (previewCache?.error ? ` Last error: ${previewCache.error}` : "")
            }
          >
            <DatabaseZap size={14} />
            {previewCacheOn && previewCache
              ? `${Math.round(cachedShare * 100)}%`
              : null}
          </button>
          {previewCacheOn && (
            <button
              aria-label="Clear render cache"
              title="Delete the cached frames and render again"
              disabled={!previewCache?.bytes}
              onClick={onClearPreviewCache}
            >
              <Trash2 size={13} />
            </button>
          )}
          <button
            aria-label="Timeline snapping"
            title="Snap to clip edges and playhead. Alt bypasses"
            aria-pressed={snapping}
            onClick={() => setSnapping(!snapping)}
          >
            <Magnet size={14} />
          </button>
          <label>
            Zoom{" "}
            <input
              aria-label="Timeline zoom"
              type="range"
              min="0"
              max={Math.log2(maxZoom)}
              step="0.05"
              value={Math.log2(zoom)}
              onChange={(e) => zoomTo(2 ** Number(e.target.value))}
            />
          </label>
          <button
            onClick={() => zoomTo(1)}
            title="Fit timeline. Pinch or Cmd-scroll over the timeline to zoom"
          >
            {zoom < 10 ? Number(zoom.toFixed(1)) : Math.round(zoom)}×
          </button>
        </div>
      </div>
      <div className="timeline-scroll" ref={scroller}>
        <div
          className="timeline-content"
          ref={contentRef}
          style={
            {
              width: `${zoom * 100}%`,
              "--grid": `${(step / project.duration) * 100}%`,
            } as React.CSSProperties
          }
        >
          {marquee && (
            <div
              className="timeline-marquee"
              style={{
                left: marquee.left,
                top: marquee.top,
                width: marquee.width,
                height: marquee.height,
              }}
            />
          )}
          <div className="ruler">
            <span className="track-label layers-heading">
              LAYERS{" "}
              <button
                onClick={onAddLayer}
                aria-label="New layer"
                title="New layer"
                disabled={tracks.length >= 40}
              >
                <Plus size={14} />
              </button>
            </span>
            <div
              role="slider"
              tabIndex={0}
              aria-label="Timeline playhead"
              aria-valuemin={0}
              aria-valuemax={Math.round(project.duration * project.fps) - 1}
              aria-valuenow={frame}
              aria-valuetext={`${(frame / project.fps).toFixed(2)} seconds`}
              onKeyDown={(e) => {
                const d = e.shiftKey ? project.fps : 1;
                const f =
                  e.key === "ArrowRight"
                    ? frame + d
                    : e.key === "ArrowLeft"
                      ? frame - d
                      : e.key === "Home"
                        ? 0
                        : e.key === "End"
                          ? Math.round(project.duration * project.fps) - 1
                          : null;
                if (f !== null) {
                  e.preventDefault();
                  e.stopPropagation();
                  onSeek(
                    clamp(f, 0, Math.round(project.duration * project.fps) - 1),
                  );
                }
              }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                seek(e, e.currentTarget);
              }}
              onPointerMove={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId))
                  seek(e, e.currentTarget);
              }}
              onPointerUp={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId))
                  e.currentTarget.releasePointerCapture(e.pointerId);
              }}
            >
              {ticks}
              {cacheRuns.map((r) => (
                <i
                  key={r.left}
                  className={`cache-run ${r.drawing ? "drawing" : ""}`}
                  style={{
                    left: `${r.left * 100}%`,
                    width: `${r.width * 100}%`,
                  }}
                />
              ))}
            </div>
          </div>
          {[...tracks].reverse().map((track) => {
            const elements = project.layers.filter(
              (e) => elementTrackId(e) === track.id,
            );
            return (
              <div
                key={track.id}
                data-track-id={track.id}
                className={`track ${selectedTrack === track.id ? "selected-track" : ""} ${rowDragging === track.id ? "reordering" : ""} ${rowDrop?.id === track.id ? "drop-" + rowDrop.edge : ""}`}
              >
                <div className="track-label">
                  <button
                    className="reorder-grip"
                    aria-label={`Reorder ${track.name}`}
                    title="Drag to reorder layers"
                    onPointerDown={(e) => beginReorder(e, track)}
                    onKeyDown={(e) => reorderKey(e, track)}
                  >
                    <GripVertical size={13} />
                  </button>
                  <button
                    title={track.name}
                    aria-pressed={selectedTrack === track.id}
                    onClick={() => onSelectTrack(track.id)}
                    onDoubleClick={() => onEditLayer(track)}
                  >
                    <Layers size={12} />
                    <span>{track.name}</span>
                  </button>
                  <button
                    className="layer-settings-button"
                    aria-label={`Settings for ${track.name}`}
                    title="Layer settings"
                    onClick={() => onEditLayer(track)}
                  >
                    <Settings2 size={12} />
                  </button>
                </div>
                <div
                  className={`track-lane ${mediaTarget?.id === track.id ? "media-drop-target" : ""}`}
                  onDragOver={(e) => {
                    if (!e.dataTransfer.types.includes(MEDIA_DRAG_TYPE)) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                    const rect = e.currentTarget.getBoundingClientRect();
                    let time = clamp(
                      ((e.clientX - rect.left) / rect.width) * project.duration,
                      0,
                      project.duration,
                    );
                    if (snapping && !e.altKey)
                      time = snapValue(
                        time,
                        [
                          frame / project.fps,
                          ...elements.flatMap((c) => [
                            c.start,
                            c.start + c.duration,
                          ]),
                        ],
                        (8 / rect.width) * project.duration,
                      );
                    setMediaTarget({
                      id: track.id,
                      time: Math.round(time * project.fps) / project.fps,
                    });
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node))
                      setMediaTarget(null);
                  }}
                  onDrop={(e) => {
                    const src = e.dataTransfer.getData(MEDIA_DRAG_TYPE);
                    if (!src) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const time =
                      mediaTarget?.id === track.id
                        ? mediaTarget.time
                        : ((e.clientX - rect.left) / rect.width) *
                          project.duration;
                    setMediaTarget(null);
                    onDropMedia(src, track.id, time);
                  }}
                  onPointerDown={beginMarquee}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      onSelectTrack(track.id);
                      seek(e, e.currentTarget);
                    }
                  }}
                >
                  {!elements.length && (
                    <span className="empty-track">Drop media here</span>
                  )}
                  {elements.map((layer) => {
                    const asset = assets.find((a) => a.src === layer.src);
                    const phases = phaseLengths(layer, project.effects);
                    return (
                      <React.Fragment key={layer.id}>
                        <div
                          data-element-id={layer.id}
                          className={`clip ${layer.type} ${effectTarget === layer.id ? "effect-drop-target" : ""} ${drag?.id === layer.id ? "dragging" : ""}`}
                          onDragOver={(e) => {
                            if (
                              e.dataTransfer.types.includes(EFFECT_DRAG_TYPE) &&
                              layer.type !== "audio"
                            ) {
                              e.preventDefault();
                              e.stopPropagation();
                              setEffectTarget(layer.id);
                            }
                          }}
                          onDragLeave={() => setEffectTarget(null)}
                          onDrop={(e) => {
                            const id = e.dataTransfer.getData(EFFECT_DRAG_TYPE);
                            if (id) {
                              e.preventDefault();
                              e.stopPropagation();
                              setEffectTarget(null);
                              onApplyEffect(id, layer.id);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-pressed={selected.includes(layer.id)}
                          aria-label={`${layer.name}, start ${layer.start.toFixed(2)} seconds, length ${layer.duration.toFixed(2)} seconds`}
                          style={{
                            left: `${(layer.start / project.duration) * 100}%`,
                            width: `${(layer.duration / project.duration) * 100}%`,
                            opacity: layer.visible ? 1 : 0.35,
                          }}
                          onPointerDown={(e) => begin(e, layer)}
                          onKeyDown={(e) => {
                            if (e.target !== e.currentTarget) return;
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              select(layer.id, e.shiftKey);
                            }
                            if (
                              e.key === "ArrowLeft" ||
                              e.key === "ArrowRight"
                            ) {
                              e.preventDefault();
                              e.stopPropagation();
                              onCommit(
                                moveClips(
                                  project,
                                  selected.includes(layer.id)
                                    ? selected
                                    : [layer.id],
                                  (e.key === "ArrowLeft" ? -1 : 1) *
                                    (e.shiftKey ? 1 : 1 / project.fps),
                                  false,
                                  0,
                                  0,
                                ),
                              );
                            }
                          }}
                        >
                          {asset?.peaks.length ? (
                            <Waveform
                              peaks={asset.peaks}
                              offset={layer.offset}
                              duration={layer.duration}
                              sourceDuration={asset.duration ?? layer.duration}
                            />
                          ) : null}
                          <span className="clip-name">{layer.name}</span>
                          {visibleKeyframeTimes(layer).map((time) => (
                            <button
                              key={time}
                              className="clip-keyframe"
                              style={{
                                left: `${(time / layer.duration) * 100}%`,
                              }}
                              title={`Keyframe at ${time.toFixed(2)}s. Click to seek; drag to retime.`}
                              aria-label={`${layer.name} keyframe at ${time.toFixed(2)} seconds`}
                              onPointerDown={(e) =>
                                beginKeyframe(e, layer, time)
                              }
                              onClick={(e) => e.stopPropagation()}
                            />
                          ))}
                          {(["in", "out"] as const).map((phase) => {
                            const length = phases[phase];
                            if (length === null) return null;
                            const share = `${(length / layer.duration) * 100}%`;
                            const name = phase === "in" ? "In" : "Out";
                            return (
                              <React.Fragment key={phase}>
                                <span
                                  className={`clip-phase ${phase}`}
                                  style={{ width: share }}
                                  aria-hidden="true"
                                />
                                <button
                                  className={`phase-handle ${phase}`}
                                  style={
                                    phase === "in"
                                      ? { left: share }
                                      : { right: share }
                                  }
                                  title={`${name} phase: ${length.toFixed(2)}s. Drag to retime this clip's ${phase === "in" ? "entrances" : "exits"}.`}
                                  aria-label={`${name} phase of ${layer.name}, ${length.toFixed(2)} seconds`}
                                  onPointerDown={(e) =>
                                    beginPhase(e, layer, phase, length)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) =>
                                    phaseKey(e, layer, phase, length)
                                  }
                                />
                              </React.Fragment>
                            );
                          })}
                          <button
                            className="trim-handle left"
                            aria-label={`Trim start of ${layer.name}`}
                            onPointerDown={(e) => begin(e, layer, "left")}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => trimKey(e, layer, "left")}
                          />
                          <button
                            className="trim-handle right"
                            aria-label={`Trim end of ${layer.name}`}
                            onPointerDown={(e) => begin(e, layer, "right")}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => trimKey(e, layer, "right")}
                          />
                        </div>
                        {drag?.id === layer.id && (
                          <span
                            className="drag-time"
                            style={{
                              left: `${(layer.start / project.duration) * 100}%`,
                            }}
                          >
                            {drag.label}
                          </span>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {mediaTarget?.id === track.id && (
                    <div
                      className="media-drop-indicator"
                      style={{
                        left: `${(mediaTarget.time / project.duration) * 100}%`,
                      }}
                    >
                      <span>{mediaTarget.time.toFixed(2)}s</span>
                    </div>
                  )}
                  <div
                    className="playhead"
                    style={{
                      left: `${(frame / project.fps / project.duration) * 100}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
