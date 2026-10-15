import React from "react";
// Timeline rows re-render on every played frame; the waveform only changes with the clip.
export const Waveform = React.memo(function Waveform({
  peaks,
  offset = 0,
  duration,
  sourceDuration,
}: {
  peaks: number[];
  offset?: number;
  duration?: number;
  sourceDuration?: number;
}) {
  const start = sourceDuration ? offset / sourceDuration : 0,
    length = sourceDuration && duration ? duration / sourceDuration : 1;
  const values = Array.from(
    { length: 100 },
    (_, i) =>
      peaks[
        Math.min(
          peaks.length - 1,
          Math.max(0, Math.floor((start + (i / 100) * length) * peaks.length)),
        )
      ] ?? 0,
  );
  return (
    <svg
      className="waveform"
      viewBox="0 0 200 40"
      preserveAspectRatio="none"
      aria-label="Audio waveform"
      role="img"
    >
      {values.map((v, i) => (
        <line
          key={i}
          x1={i * 2 + 1}
          x2={i * 2 + 1}
          y1={20 - Math.max(1, v * 18)}
          y2={20 + Math.max(1, v * 18)}
          stroke="currentColor"
          strokeWidth="1.3"
        />
      ))}
    </svg>
  );
});
