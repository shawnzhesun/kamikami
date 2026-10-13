import React from "react";
import type { TextEffect } from "../text-effects";
import { isTitleKind, titleControls } from "../title-effects";
import {
  DEFAULT_TEMPO,
  isKineticKind,
  kineticControls,
  kineticRole,
} from "../kinetic-type";
import { isLookKind, lookControls } from "../text-looks";
import { isLayoutKind, layoutControls } from "../text-layouts";
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
  if (isKineticKind(text.kind))
    return <KineticControls text={text} onChange={onChange} />;
  if (isLookKind(text.kind))
    return <LookControls text={text} onChange={onChange} />;
  if (isLayoutKind(text.kind))
    return <LayoutControls text={text} onChange={onChange} />;
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

const motionDefaults = {
  depth: 3,
  spread: 2,
  rotation: 90,
  order: "forward",
  direction: "in",
  easing: "smooth",
} as const;
/** Kinetic type: entrances, exit-only motions and tempo-driven holds. */
function KineticControls({
  text,
  onChange,
}: {
  text: TextEffect;
  onChange: (patch: Partial<TextEffect>) => void;
}) {
  if (!isKineticKind(text.kind)) return null;
  const c = kineticControls[text.kind];
  const role = kineticRole(text.kind);
  const motion = { ...motionDefaults, ...text.motion };
  return (
    <>
      {role === "hold" ? (
        <NumberField
          label="Tempo (BPM)"
          value={text.tempo ?? DEFAULT_TEMPO}
          min={30}
          max={240}
          step={1}
          onChange={(tempo) => onChange({ tempo })}
        />
      ) : (
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
            Order
            <Dropdown
              label="Stagger order"
              value={motion.order}
              options={[
                { value: "forward", label: "First to last" },
                { value: "reverse", label: "Last to first" },
                { value: "random", label: "Random" },
                { value: "center", label: "Center out" },
                { value: "edges", label: "Edges in" },
              ]}
              onChange={(order) =>
                onChange({
                  motion: {
                    ...motion,
                    order: order as typeof motion.order,
                  },
                })
              }
            />
          </label>
          {role === "enter" && (
            <label>
              Play as
              <Dropdown
                label="Entrance or exit"
                value={motion.direction}
                options={[
                  { value: "in", label: "Entrance (clip start)" },
                  { value: "out", label: "Exit (clip end)" },
                ]}
                onChange={(direction) =>
                  onChange({
                    motion: { ...motion, direction: direction as "in" | "out" },
                  })
                }
              />
            </label>
          )}
        </>
      )}
      <label>
        Animate by
        <Dropdown
          label="Kinetic animation unit"
          value={text.unit}
          options={[
            { value: "character", label: "Character" },
            { value: "word", label: "Word" },
            { value: "title", label: "Whole title" },
          ]}
          onChange={(unit) => onChange({ unit: unit as TextEffect["unit"] })}
        />
      </label>
      {c.direction && (
        <label>
          Direction
          <Dropdown
            label="Kinetic direction"
            value={text.direction ?? c.direction[0][0]}
            options={c.direction.map(([value, label]) => ({ value, label }))}
            onChange={(direction) =>
              onChange({ direction: direction as TextEffect["direction"] })
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
      {c.secondary && (
        <label>
          {c.secondary}
          <input
            type="color"
            value={text.secondary}
            onChange={(event) => onChange({ secondary: event.target.value })}
          />
        </label>
      )}
      {c.note && <small className="muted">{c.note}</small>}
    </>
  );
}

/** Text looks: paint treatments and decorations. */
function LookControls({
  text,
  onChange,
}: {
  text: TextEffect;
  onChange: (patch: Partial<TextEffect>) => void;
}) {
  if (!isLookKind(text.kind)) return null;
  const c = lookControls[text.kind];
  return (
    <>
      {c.reveal && (
        <>
          <NumberField
            label="Draw-in (seconds)"
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
        </>
      )}
      {text.kind === "accent" && (
        <label>
          Accent
          <Dropdown
            label="Accent unit"
            value={text.unit === "character" ? "character" : "word"}
            options={[
              { value: "word", label: "Longest word" },
              { value: "character", label: "First letter of each line" },
            ]}
            onChange={(unit) => onChange({ unit: unit as TextEffect["unit"] })}
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
      {c.angle && (
        <NumberField
          label="Angle (degrees)"
          value={text.angle ?? 45}
          min={-180}
          max={180}
          step={1}
          onChange={(angle) => onChange({ angle })}
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
      {c.secondary && (
        <label>
          {c.secondary}
          <input
            type="color"
            value={text.secondary}
            onChange={(event) => onChange({ secondary: event.target.value })}
          />
        </label>
      )}
      {c.note && <small className="muted">{c.note}</small>}
    </>
  );
}

/** Kinetic layouts: whole-phrase word arrangements. */
function LayoutControls({
  text,
  onChange,
}: {
  text: TextEffect;
  onChange: (patch: Partial<TextEffect>) => void;
}) {
  if (!isLayoutKind(text.kind)) return null;
  const c = layoutControls[text.kind];
  return (
    <>
      {c.tempo && (
        <NumberField
          label={c.tempo}
          value={text.tempo ?? DEFAULT_TEMPO}
          min={30}
          max={240}
          step={1}
          onChange={(tempo) => onChange({ tempo })}
        />
      )}
      {c.seconds && (
        <NumberField
          label={c.seconds}
          value={text.seconds}
          min={0.05}
          max={30}
          step={0.05}
          onChange={(seconds) => onChange({ seconds })}
        />
      )}
      {c.stagger && (
        <NumberField
          label={c.stagger}
          value={text.stagger}
          min={0}
          max={0.95}
          step={0.01}
          onChange={(stagger) => onChange({ stagger })}
        />
      )}
      {c.order && (
        <label>
          {c.order}
          <Dropdown
            label="Word order"
            value={text.motion?.order ?? "forward"}
            options={[
              { value: "forward", label: "First to last" },
              { value: "reverse", label: "Last to first" },
              { value: "center", label: "From the middle" },
              { value: "edges", label: "From the ends" },
              { value: "random", label: "Random" },
            ]}
            onChange={(order) =>
              onChange({
                motion: {
                  depth: 3,
                  spread: 2,
                  rotation: 90,
                  direction: "in",
                  easing: "smooth",
                  ...text.motion,
                  order: order as NonNullable<TextEffect["motion"]>["order"],
                },
              })
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
      {c.angle && (
        <NumberField
          label={c.angle}
          value={text.angle ?? 7}
          min={-180}
          max={180}
          step={1}
          onChange={(angle) => onChange({ angle })}
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
      {c.secondary && (
        <label>
          {c.secondary}
          <input
            type="color"
            value={text.secondary}
            onChange={(event) => onChange({ secondary: event.target.value })}
          />
        </label>
      )}
      <small className="muted">
        Layouts move whole words; add kinetic motions or text treatments on top.
      </small>
    </>
  );
}
