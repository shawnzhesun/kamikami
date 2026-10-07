import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlignCenter, AlignCenterVertical, Magnet } from "lucide-react";
import type { Layer, Project } from "../model";
import type { MediaAsset } from "../media";
import {
  clamp,
  hitBounds,
  layerBounds,
  snapValue,
  translateLayers,
  visibleAt,
  type Bounds,
} from "./editing";
import { startGesture } from "./gesture";

type Props = {
  project: Project;
  frame: number;
  selected: string[];
  assets: MediaAsset[];
  playing: boolean;
  onSelect: (ids: string[]) => void;
  onPreview: (p: Project | null) => void;
  onCommit: (p: Project, base?: Project) => void;
  onPause: () => void;
};
export function CanvasEditor({
  project,
  frame,
  selected,
  assets,
  playing,
  onSelect,
  onPreview,
  onCommit,
  onPause,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const [sizes, setSizes] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const [snap, setSnap] = useState(true);
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(
    null,
  );
  useEffect(() => () => cleanup.current?.(), []);
  useLayoutEffect(() => {
    const next: typeof sizes = {};
    for (const l of project.layers) {
      if (l.type === "title") {
        const element = root.current?.parentElement?.querySelector<HTMLElement>(
          `[data-layer-content="${CSS.escape(l.id)}"]`,
        );
        next[l.id] = {
          width: Math.max(40, element?.offsetWidth ?? 400),
          height: Math.max(l.fontSize, element?.offsetHeight ?? l.fontSize),
        };
      } else {
        const asset = assets.find((a) => a.src === l.src);
        const fit =
          asset?.width && asset.height
            ? Math.min(1920 / asset.width, 1080 / asset.height)
            : 1;
        next[l.id] = {
          width: asset?.width ? asset.width * fit : 1920,
          height: asset?.height ? asset.height * fit : 1080,
        };
      }
    }
    setSizes(next);
  }, [project, frame, assets]);
  const visible = project.layers.filter((l) =>
    visibleAt(l, frame, project.fps),
  );
  const box = (l: Layer): Bounds =>
    layerBounds(
      l,
      project,
      frame,
      sizes[l.id] ?? { width: 1920, height: 1080 },
    );
  const point = (e: { clientX: number; clientY: number }) => {
    const r = root.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * 1920,
      y: ((e.clientY - r.top) / r.height) * 1080,
    };
  };
  const hit = (e: { clientX: number; clientY: number }) => {
    const p = point(e);
    return [...visible].reverse().find((l) => hitBounds(p.x, p.y, box(l)));
  };
  const finishText = () => {
    if (!editing) return;
    onCommit({
      ...project,
      layers: project.layers.map((l) =>
        l.id === editing.id ? { ...l, text: editing.text } : l,
      ),
    });
    setEditing(null);
  };
  function gesture(
    e: React.PointerEvent<HTMLElement>,
    layer: Layer,
    mode: "move" | "scale" | "rotate",
  ) {
    if (e.button !== 0 || editing) return;
    e.preventDefault();
    e.stopPropagation();
    root.current?.focus({ preventScroll: true });
    onPause();
    cleanup.current?.();
    const base = project;
    let ids = selected.includes(layer.id) ? selected : [layer.id];
    if (e.shiftKey && mode === "move") {
      ids = selected.includes(layer.id)
        ? selected.filter((id) => id !== layer.id)
        : [...selected, layer.id];
      onSelect(ids);
      return;
    }
    onSelect(ids);
    const origin = point(e),
      bounds = box(layer);
    const radius = Math.hypot(origin.x - bounds.cx, origin.y - bounds.cy);
    const angle = Math.atan2(origin.y - bounds.cy, origin.x - bounds.cx);
    let latest = base,
      moved = false;
    cleanup.current = startGesture(
      e,
      (event) => {
        const p = point(event),
          dx = p.x - origin.x,
          dy = p.y - origin.y;
        if (!moved && Math.hypot(dx, dy) < 3) return;
        moved = true;
        if (mode === "move") {
          let x = dx,
            y = dy;
          const guide: { x?: number; y?: number } = {};
          if (snap && !event.altKey) {
            const others = visible.filter((l) => !ids.includes(l.id)).map(box);
            const tx = [0, 960, 1920, ...others.map((b) => b.cx)],
              ty = [0, 540, 1080, ...others.map((b) => b.cy)];
            const sx = snapValue(bounds.cx + dx, tx, 12),
              sy = snapValue(bounds.cy + dy, ty, 12);
            if (sx !== bounds.cx + dx) {
              x = sx - bounds.cx;
              guide.x = sx;
            }
            if (sy !== bounds.cy + dy) {
              y = sy - bounds.cy;
              guide.y = sy;
            }
          }
          setGuides(guide);
          latest = translateLayers(base, ids, x, y);
        } else {
          const scale =
            mode === "scale"
              ? clamp(
                  (layer.scale * Math.hypot(p.x - bounds.cx, p.y - bounds.cy)) /
                    Math.max(radius, 1),
                  0.05,
                  5,
                )
              : layer.scale;
          let rotation =
            layer.rotation +
            ((Math.atan2(p.y - bounds.cy, p.x - bounds.cx) - angle) * 180) /
              Math.PI;
          if (event.shiftKey) rotation = Math.round(rotation / 15) * 15;
          rotation = ((rotation + 540) % 360) - 180;
          latest = {
            ...base,
            layers: base.layers.map((l) =>
              l.id === layer.id
                ? {
                    ...l,
                    scale,
                    rotation: mode === "rotate" ? rotation : l.rotation,
                  }
                : l,
            ),
          };
        }
        onPreview(latest);
      },
      (cancelled) => {
        onPreview(null);
        setGuides({});
        if (!cancelled && moved) onCommit(latest, base);
        cleanup.current = null;
      },
    );
  }
  function align(axis: "x" | "y") {
    onPause();
    onCommit({
      ...project,
      layers: project.layers.map((l) => {
        if (!selected.includes(l.id) || !visible.includes(l)) return l;
        const b = box(l);
        return {
          ...l,
          [axis]: clamp(
            l[axis] + (axis === "x" ? 960 - b.cx : 540 - b.cy),
            axis === "x" ? -1920 : -1080,
            axis === "x" ? 1920 : 1080,
          ),
        };
      }),
    });
  }
  return (
    <>
      <div className="canvas-tools" aria-label="Canvas tools">
        <button
          title="Snap to canvas and layer centers (Alt bypasses)"
          aria-label="Canvas snapping"
          aria-pressed={snap}
          onClick={() => setSnap(!snap)}
        >
          <Magnet size={14} />
        </button>
        <button
          title="Center selected layers horizontally"
          aria-label="Center horizontally"
          disabled={!selected.length}
          onClick={() => align("x")}
        >
          <AlignCenter size={14} />
        </button>
        <button
          title="Center selected layers vertically"
          aria-label="Center vertically"
          disabled={!selected.length}
          onClick={() => align("y")}
        >
          <AlignCenterVertical size={14} />
        </button>
      </div>
      <div
        className="canvas-editor"
        ref={root}
        tabIndex={0}
        aria-label="Canvas editor. Select and drag layers. Arrow keys move the selection."
        onPointerDown={(e) => {
          if (playing) onPause();
          const l = hit(e);
          if (l) gesture(e, l, "move");
          else onSelect([]);
        }}
        onDoubleClick={(e) => {
          const l = hit(e);
          if (l?.type === "title") {
            onPause();
            onSelect([l.id]);
            setEditing({ id: l.id, text: l.text });
          }
        }}
        onKeyDown={(e) => {
          if (editing || e.target !== e.currentTarget) return;
          const d = e.shiftKey ? 10 : 1;
          const delta =
            e.key === "ArrowLeft"
              ? [-d, 0]
              : e.key === "ArrowRight"
                ? [d, 0]
                : e.key === "ArrowUp"
                  ? [0, -d]
                  : e.key === "ArrowDown"
                    ? [0, d]
                    : null;
          if (delta) {
            e.preventDefault();
            e.stopPropagation();
            onCommit(translateLayers(project, selected, delta[0], delta[1]));
          }
        }}
      >
        {!playing &&
          visible
            .filter((l) => selected.includes(l.id))
            .map((l) => {
              const b = box(l);
              return (
                <div
                  key={l.id}
                  className="canvas-selection"
                  style={{
                    left: `${(b.cx / 1920) * 100}%`,
                    top: `${(b.cy / 1080) * 100}%`,
                    width: `${((b.width * b.scale) / 1920) * 100}%`,
                    height: `${((b.height * b.scale) / 1080) * 100}%`,
                    transform: `translate(-50%,-50%) rotate(${b.rotation}deg)`,
                  }}
                >
                  <span className="canvas-layer-name">{l.name}</span>
                  {["nw", "ne", "se", "sw"].map((c) => (
                    <button
                      key={c}
                      className={`canvas-handle ${c}`}
                      aria-label={`Resize ${l.name} ${c}`}
                      onPointerDown={(e) => gesture(e, l, "scale")}
                    />
                  ))}
                  <button
                    className="canvas-rotate"
                    aria-label={`Rotate ${l.name}`}
                    title="Rotate. Hold Shift for 15° steps"
                    onPointerDown={(e) => gesture(e, l, "rotate")}
                  >
                    ↻
                  </button>
                </div>
              );
            })}
        {guides.x !== undefined && (
          <i
            className="canvas-guide vertical"
            style={{ left: `${(guides.x / 1920) * 100}%` }}
          />
        )}
        {guides.y !== undefined && (
          <i
            className="canvas-guide horizontal"
            style={{ top: `${(guides.y / 1080) * 100}%` }}
          />
        )}
      </div>
      {editing && (
        <div
          className="canvas-text-editor"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <label>
            Edit text
            <textarea
              autoFocus
              aria-label="Canvas text"
              maxLength={2000}
              value={editing.text}
              onChange={(e) => setEditing({ ...editing, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setEditing(null);
                }
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") finishText();
              }}
            />
          </label>
          <div>
            <button onClick={() => setEditing(null)}>Cancel</button>
            <button className="primary" onClick={finishText}>
              Apply text
            </button>
          </div>
        </div>
      )}
    </>
  );
}
