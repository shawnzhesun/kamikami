import React from "react";
import type { TextEffect } from "../text-effects";
import { isTitleKind, titleControls } from "../title-effects";
import { Dropdown } from "./Dropdown";
import { NumberField } from "./NumberField";

/** Settings for title-pack text kinds, driven by each kind's control table. */
export function TitleEffectControls({
  text,
  onChange,
}: {
  text: TextEffect;
  onChange: (patch: Partial<TextEffect>) => void;
}) {
  if (!isTitleKind(text.kind)) return null;
  const c = titleControls[text.kind];
  return (
    <>
      {c.entrance && (
        <>
          <NumberField
            label="Duration (seconds)"
            value={text.seconds}
            min={0.05}
            max={30}
            step={0.05}
            onChange={(seconds) => onChange({ seconds })}
          />
          <NumberField
            label="Stagger"
            value={text.stagger}
            min={0}
            max={0.95}
            step={0.01}
            onChange={(stagger) => onChange({ stagger })}
          />
          <label>
            Play as
            <Dropdown
              label="Entrance or exit"
              value={text.motion?.direction ?? "in"}
              options={[
                { value: "in", label: "Entrance (clip start)" },
                { value: "out", label: "Exit (clip end)" },
              ]}
              onChange={(direction) =>
                onChange({
                  motion: {
                    depth: 3,
                    spread: 2,
                    rotation: 90,
                    order: "forward",
                    easing: "smooth",
                    ...text.motion,
                    direction: direction as "in" | "out",
                  },
                })
              }
            />
          </label>
        </>
      )}
      {c.units && (
        <label>
          Animate by
          <Dropdown
            label="Title animation unit"
            value={text.unit}
            options={[
              { value: "character", label: "Character" },
              { value: "word", label: "Word" },
              { value: "title", label: "Whole title" },
            ]}
            onChange={(unit) => onChange({ unit: unit as TextEffect["unit"] })}
          />
        </label>
      )}
      {c.direction && (
        <label>
          Direction
          <Dropdown
            label="Title direction"
            value={text.direction ?? c.direction[0][0]}
            options={c.direction.map(([value, label]) => ({ value, label }))}
            onChange={(direction) =>
              onChange({ direction: direction as TextEffect["direction"] })
            }
          />
        </label>
      )}
      {c.variant && (
        <label>
          Look
          <Dropdown
            label="Title look"
            value={text.variant ?? c.variant[0][0]}
            options={c.variant.map(([value, label]) => ({ value, label }))}
            onChange={(variant) =>
              onChange({ variant: variant as TextEffect["variant"] })
            }
          />
        </label>
      )}
      {c.distance && (
        <NumberField
          label={c.distance}
          value={text.distance}
          min={0}
          max={3}
          step={0.05}
          onChange={(distance) => onChange({ distance })}
        />
      )}
      {c.speed && (
        <NumberField
          label={c.speed}
          value={text.speed}
          min={0}
          max={10}
          step={0.1}
          onChange={(speed) => onChange({ speed })}
        />
      )}
      {c.color && (
        <label>
          {c.color}
          <input
            type="color"
            value={text.color}
            onChange={(event) => onChange({ color: event.target.value })}
          />
        </label>
      )}
      {c.note && <small className="muted">{c.note}</small>}
    </>
  );
}
