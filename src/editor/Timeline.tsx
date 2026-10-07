import React, { useEffect, useRef, useState } from "react";
import {
  Layers,
  Magnet,
  Scissors,
  GripVertical,
  Plus,
  Settings2,
} from "lucide-react";
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
import { startGesture } from "./gesture";
import { Waveform } from "./Waveform";
import { EFFECT_DRAG_TYPE } from "../effect-bundle";

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
  onApplyEffect: (effectId: string, layerId: string) => void;
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
  onApplyEffect,
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
  const scroller = useRef<HTMLDivElement>(null);
  const ignoreClickUntil = useRef(0);
  const [rowDrop, setRowDrop] = useState<{
    id: string;
    edge: "above" | "below";
  } | null>(null);
  const [rowDragging, setRowDragging] = useState<string | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
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
    if (e.shiftKey && !edge) {
      select(layer.id, true);
      return;
    }
    const ids = edge
      ? [layer.id]
      : selected.includes(layer.id)
        ? selected
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
        cleanup.current = null;
      },
    );
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
          <button
            onClick={split}
            disabled={!selected.length}
            title="Split selected clips at playhead"
          >
            <Scissors size={14} />
            Split
          </button>
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
              min="1"
              max="8"
              step=".5"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </label>
          <button onClick={() => setZoom(1)} title="Fit timeline">
            {zoom}×
          </button>
        </div>
      </div>
      <div className="timeline-scroll" ref={scroller}>
        <div className="timeline-content" style={{ width: `${zoom * 100}%` }}>
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
              {Array.from({ length: Math.ceil(zoom * 5) + 1 }, (_, i) => {
                const n = Math.ceil(zoom * 5);
                return (
                  <span key={i} style={{ left: `${(i / n) * 100}%` }}>
                    {Number(((project.duration * i) / n).toFixed(1))}s
                  </span>
                );
              })}
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
