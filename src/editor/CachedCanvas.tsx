import React, { useLayoutEffect, useRef } from "react";

/** One decoded frame from the preview render cache, stretched over the frame. */
export function CachedCanvas({ bitmap }: { bitmap: ImageBitmap }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    try {
      canvas.current?.getContext("2d")?.drawImage(bitmap, 0, 0);
    } catch {
      // The preloader freed it; the next frame draws again.
    }
  }, [bitmap]);
  return (
    <canvas
      ref={canvas}
      className="cached-frame"
      width={bitmap.width}
      height={bitmap.height}
    />
  );
}
