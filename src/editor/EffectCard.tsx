import React, { useEffect, useState, useRef } from "react";
import { Play, Pause } from "lucide-react";
import { layerAtTime, makeLayer, type Effect } from "../model";
import { startGesture } from "./gesture";
const sample = { ...makeLayer("scene", "Preview"), duration: 6 };
export function EffectCard({
  effect,
  onApply,
  onInspect,
  onDrop,
}: {
  effect: Effect;
  onApply: () => void;
  onInspect: () => void;
  onDrop: (layerId: string) => void;
}) {
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState(false),
    [pinned, setPinned] = useState(false),
    [time, setTime] = useState(0),
    [paused, setPaused] = useState(false);
  const [reduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const playing = !paused && (pinned || (hover && !reduced));
  useEffect(() => {
    if (!playing) {
      setTime(0);
      return;
    }
    let id: number, start: number | undefined;
    const tick = (now: number) => {
      start ??= now;
      setTime(((now - start) / 1000) % 6);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing]);
  const value = layerAtTime(
    { ...sample, effects: [{ effectId: effect.id, amount: 1, enabled: true }] },
    [effect],
    time,
  );
  return (
    <div
      className={`effect-card ${dragging ? "effect-dragging" : ""}`}
      tabIndex={0}
      role="group"
      aria-label={`${effect.name}. Drag onto a clip; Enter applies to selected layers.`}
      title={effect.description + " · Drag to apply. Double-click to inspect."}
      onPointerDown={(e) => {
        if (e.button !== 0 || (e.target as HTMLElement).closest("button"))
          return;
        e.preventDefault();
        e.currentTarget.focus();
        cleanup.current?.();
        const origin = { x: e.clientX, y: e.clientY };
        let target: HTMLElement | null = null,
          moved = false;
        cleanup.current = startGesture(
          e,
          (event) => {
            if (
              !moved &&
              Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 5
            )
              return;
            moved = true;
            setDragging(true);
            setHover(false);
            target?.classList.remove("effect-drop-target");
            const scroller =
              document.querySelector<HTMLElement>(".timeline-scroll");
            if (scroller) {
              const r = scroller.getBoundingClientRect();
              if (event.clientX >= r.left && event.clientX <= r.right) {
                if (
                  event.clientY > r.bottom - 24 &&
                  event.clientY < r.bottom + 24
                )
                  scroller.scrollTop += 12;
                if (event.clientY < r.top + 40 && event.clientY > r.top)
                  scroller.scrollTop -= 12;
              }
            }
            target =
              document
                .elementFromPoint(event.clientX, event.clientY)
                ?.closest<HTMLElement>("[data-track-id]") ?? null;
            target?.classList.add("effect-drop-target");
          },
          (cancelled) => {
            target?.classList.remove("effect-drop-target");
            setDragging(false);
            cleanup.current = null;
            if (!cancelled && moved && target?.dataset.trackId)
              onDrop(target.dataset.trackId);
          },
        );
      }}
      onDoubleClick={onInspect}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && e.key === "Enter") {
          e.preventDefault();
          onApply();
        }
      }}
      onMouseEnter={() => {
        setHover(true);
        setPaused(false);
      }}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setHover(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHover(false);
      }}
    >
      <div
        className="effect-sample"
        aria-label={`${effect.name} sample graphic preview`}
      >
        <div
          className="effect-sample-art"
          style={{
            transform: `translate(${value.x * 0.15}px,${value.y * 0.15}px) rotate(${value.rotation}deg) scale(${value.scale})`,
            opacity: value.opacity,
            filter: `brightness(${value.brightness}) blur(${value.blur * 0.15}px)`,
          }}
        >
          <svg viewBox="0 0 180 96" aria-hidden="true">
            <rect width="180" height="96" rx="7" fill="#315B8C" />
            <circle cx="137" cy="27" r="16" fill="#F2765E" />
            <path d="M0 96 54 23 107 96M65 96 118 47 180 96" fill="#F5EBDD" />
            <path d="m34 51 20-28 21 29-21-8Z" fill="#F2765E" />
            <path d="M0 83h180v13H0Z" fill="#413333" />
          </svg>
          {effect.tint > 0 && (
            <span
              style={{
                background: effect.color,
                opacity: effect.tint,
                mixBlendMode: "screen",
              }}
            />
          )}
        </div>
        <button
          className="effect-preview-play"
          aria-label={`${playing ? "Stop" : "Play"} ${effect.name} preview`}
          aria-pressed={playing}
          onClick={() => {
            setPaused(playing);
            setPinned(!playing);
          }}
        >
          {playing ? <Pause size={12} /> : <Play size={12} />}
        </button>
      </div>
      <strong>{effect.name}</strong>
    </div>
  );
}
