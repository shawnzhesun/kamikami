import React from "react";
import { lineOverlays, overlayControls, type Overlay } from "../overlays";
import { Dropdown } from "./Dropdown";
import { NumberField } from "./NumberField";

const numbers = [
  ["pad", 0, 10, 0.05],
  ["size", 0.1, 5, 0.05],
  ["weight", 0.1, 5, 0.05],
  ["angle", -180, 180, 1],
  ["count", 1, 24, 1],
  ["seconds", 0.02, 30, 0.01],
  ["speed", 0, 10, 0.1],
  ["wobble", 0, 1, 0.05],
  ["boil", 0, 24, 1],
  ["strength", 0, 1, 0.05],
] as const;

/** Settings for overlays, driven by each kind's control table. */
export function OverlayControls({
  overlay,
  onChange,
}: {
  overlay: Overlay;
  onChange: (patch: Partial<Overlay>) => void;
}) {
  const c = overlayControls[overlay.kind];
  return (
    <>
      {c.timing && (
        <label>
          {c.timing}
          <Dropdown
            label="Overlay timing"
            value={overlay.timing}
            options={[
              { value: "envelope", label: "On at the start, off at the end" },
              { value: "in", label: "On at the start" },
              { value: "out", label: "On at the end" },
              { value: "constant", label: "Always shown" },
            ]}
            onChange={(timing) =>
              onChange({ timing: timing as Overlay["timing"] })
            }
          />
        </label>
      )}
      {c.anchor && (
        <label>
          {c.anchor}
          <Dropdown
            label="Overlay anchor"
            value={overlay.anchor}
            options={[
              { value: "block", label: "The whole element" },
              { value: "keyword", label: "The key word (text)" },
              ...(lineOverlays.includes(overlay.kind)
                ? [{ value: "lines", label: "Each line (text)" }]
                : []),
            ]}
            onChange={(anchor) =>
              onChange({ anchor: anchor as Overlay["anchor"] })
            }
          />
        </label>
      )}
      {c.placement && (
        <label>
          {c.placement}
          <Dropdown
            label="Overlay side"
            value={overlay.placement}
            options={[
              { value: "auto", label: "Most free space" },
              { value: "top", label: "Top" },
              { value: "bottom", label: "Bottom" },
              { value: "left", label: "Left" },
              { value: "right", label: "Right" },
            ]}
            onChange={(placement) =>
              onChange({ placement: placement as Overlay["placement"] })
            }
          />
        </label>
      )}
      {numbers.map(([field, min, max, step]) =>
        c[field] ? (
          <NumberField
            key={field}
            label={c[field]!}
            value={overlay[field]}
            min={min}
            max={max}
            step={step}
            onChange={(value) =>
              onChange({
                [field]: field === "count" ? Math.round(value) : value,
              })
            }
          />
        ) : null,
      )}
      {c.label && (
        <label>
          {c.label}
          <input
            value={overlay.label ?? ""}
            maxLength={60}
            placeholder="Leave empty for the default"
            onChange={(event) =>
              onChange({ label: event.target.value || undefined })
            }
          />
        </label>
      )}
      {c.color && (
        <label>
          {c.color}
          <input
            type="color"
            value={overlay.color}
            onChange={(event) => onChange({ color: event.target.value })}
          />
        </label>
      )}
      {c.secondary && (
        <label>
          {c.secondary}
          <input
            type="color"
            value={overlay.secondary}
            onChange={(event) => onChange({ secondary: event.target.value })}
          />
        </label>
      )}
    </>
  );
}
