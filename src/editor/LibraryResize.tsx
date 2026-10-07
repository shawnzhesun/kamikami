import React, { useEffect, useRef } from "react";
import { startGesture } from "./gesture";
export const libraryLimit = () =>
  Math.max(220, Math.min(640, window.innerWidth - 750));
export function LibraryResize({
  width,
  onChange,
}: {
  width: number;
  onChange: (n: number) => void;
}) {
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  const set = (n: number) =>
    onChange(Math.max(220, Math.min(libraryLimit(), n)));
  return (
    <div
      className="library-resize"
      role="separator"
      aria-label="Resize media and effects library"
      aria-orientation="vertical"
      aria-valuemin={220}
      aria-valuemax={libraryLimit()}
      aria-valuenow={Math.round(width)}
      tabIndex={0}
      title="Drag to resize library. Arrow keys adjust width; double-click resets."
      onDoubleClick={() => set(280)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          set(
            width + (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 50 : 10),
          );
        }
        if (e.key === "Home") {
          e.preventDefault();
          set(220);
        }
        if (e.key === "End") {
          e.preventDefault();
          set(libraryLimit());
        }
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.focus();
        cleanup.current?.();
        const start = e.clientX,
          base = width;
        cleanup.current = startGesture(
          e,
          (event) => set(base + event.clientX - start),
          (cancelled) => {
            if (cancelled) set(base);
            cleanup.current = null;
          },
        );
      }}
    />
  );
}
