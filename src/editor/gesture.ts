import type React from "react";

let activeGestures = 0;
export const isGestureActive = () => activeGestures > 0;

/** Keep listening when a resize moves its handle away from the pointer. */
export function startGesture(
  event: React.PointerEvent<HTMLElement>,
  move: (event: PointerEvent) => void,
  finish: (cancelled: boolean) => void,
) {
  const target = event.currentTarget,
    id = event.pointerId;
  let done = false;
  const onMove = (e: PointerEvent) => {
    if (!done && e.pointerId === id) move(e);
  };
  const end = (cancelled: boolean) => {
    if (done) return;
    done = true;
    activeGestures--;
    window.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("pointerup", up, true);
    window.removeEventListener("pointercancel", cancel, true);
    window.removeEventListener("blur", cancel);
    window.removeEventListener("keydown", key, true);
    finish(cancelled);
    if (target.hasPointerCapture(id)) target.releasePointerCapture(id);
  };
  const up = (e: PointerEvent) => {
    if (e.pointerId === id) {
      onMove(e);
      end(false);
    }
  };
  const cancel = () => end(true);
  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopImmediatePropagation();
      end(true);
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z")
      end(true);
  };
  target.setPointerCapture(id);
  activeGestures++;
  window.addEventListener("pointermove", onMove, true);
  window.addEventListener("pointerup", up, true);
  window.addEventListener("pointercancel", cancel, true);
  window.addEventListener("blur", cancel);
  window.addEventListener("keydown", key, true);
  return cancel;
}
