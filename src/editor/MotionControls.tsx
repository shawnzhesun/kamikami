import React from "react";
import { NumberField } from "./NumberField";
import { Dropdown } from "./Dropdown";
import {
  DepthSchema,
  FieldSchema,
  ParticleSchema,
  type Depth,
} from "../motion";
import { TextEffectSchema, type TextEffect } from "../text-effects";
import type { VisualPass } from "../visual-effects";

type Values = Record<string, string | number | boolean>;
type Numeric = [string, string, number, number, number?];
function Numbers({
  value,
  fields,
  change,
}: {
  value: Values;
  fields: Numeric[];
  change: (patch: Values) => void;
}) {
  return (
    <>
      {fields.map(([key, label, min, max, step = 0.05]) => (
        <NumberField
          key={key}
          label={label}
          value={value[key] as number}
          min={min}
          max={max}
          step={step}
          onChange={(n) => change({ [key]: step === 1 ? Math.round(n) : n })}
        />
      ))}
    </>
  );
}
function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <Dropdown
        label={label}
        value={value}
        options={options.map(([value, label]) => ({ value, label }))}
        onChange={onChange}
      />
    </label>
  );
}
function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="settings-checkbox">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
const easing: [string, string][] = [
  ["linear", "Linear"],
  ["smooth", "Smooth"],
  ["ease-out", "Ease out"],
];
export function DepthControls({
  value,
  onChange,
}: {
  value: Depth;
  onChange: (value: Depth) => void;
}) {
  const change = (patch: Values) =>
    onChange(DepthSchema.parse({ ...value, ...patch }));
  return (
    <section className="effect-settings-section">
      <h3>Depth motion</h3>
      <p className="muted">
        Positive distance moves away; negative distance approaches the camera.
        Each element moves independently.
      </p>
      <div className="visual-pass-fields">
        <Choice
          label="Motion"
          value={value.mode}
          options={[
            ["travel", "Travel"],
            ["float", "Float"],
          ]}
          onChange={(mode) => change({ mode })}
        />
        {/* Float always breathes on a cosine; easing only shapes Travel. */}
        {value.mode !== "float" && (
          <Choice
            label="Easing"
            value={value.easing}
            options={easing}
            onChange={(easing) => change({ easing })}
          />
        )}
        <Numbers
          value={value}
          change={change}
          fields={[
            ["from", "Start distance", -0.98, 8],
            ["to", "End distance", -0.98, 8],
            ["seconds", "Duration / float period (seconds)", 0.05, 30],
            ["x", "Horizontal offset", -2, 2],
            ["y", "Vertical offset", -2, 2],
            ["tiltX", "Tilt X (degrees)", -80, 80, 1],
            ["tiltY", "Tilt Y (degrees)", -80, 80, 1],
            ["rotation", "Rotation (degrees)", -360, 360, 1],
            ["perspective", "Perspective distance", 0.5, 3],
            ["focus", "Focus distance", -0.9, 8],
            ["blur", "Focus falloff", 0, 40],
          ]}
        />
      </div>
    </section>
  );
}
export function TextMotionControls({
  text,
  onChange,
}: {
  text: TextEffect;
  onChange: (patch: Partial<TextEffect>) => void;
}) {
  if (text.kind === "glitch") {
    const g =
      text.glitch ??
      TextEffectSchema.parse({ kind: "glitch", glitch: {} }).glitch!;
    const change = (patch: Values) => onChange({ glitch: { ...g, ...patch } });
    return (
      <>
        <Choice
          label="Glitch timing"
          value={g.timing}
          options={[
            ["continuous", "Throughout clip"],
            ["entrance", "Entrance, then settle"],
            ["exit", "At clip end"],
          ]}
          onChange={(timing) => change({ timing })}
        />
        <Numbers
          value={g}
          change={change}
          fields={[
            ["affected", "Affected units", 0, 1],
            ["burst", "Burst duration (seconds)", 0.01, 1, 0.01],
            ["jitter", "Position jitter (em)", 0, 2],
            ["slices", "Slice offset (em)", 0, 2],
            ["rgb", "RGB separation (em)", 0, 0.5, 0.01],
            ["dropout", "Dropout probability", 0, 1],
          ]}
        />
        <Toggle
          label="Replace glyphs during glitch"
          value={g.substitute}
          onChange={(substitute) => change({ substitute })}
        />
        {g.substitute && (
          <label>
            Replacement characters
            <input
              aria-label="Replacement characters"
              value={g.alphabet}
              maxLength={200}
              onChange={(e) => change({ alphabet: e.target.value })}
            />
          </label>
        )}
      </>
    );
  }
  if (text.kind !== "stagger") return null;
  const m =
    text.motion ??
    TextEffectSchema.parse({ kind: "stagger", motion: {} }).motion!;
  const change = (patch: Values) => onChange({ motion: { ...m, ...patch } });
  return (
    <>
      <Choice
        label="Sequence order"
        value={m.order}
        options={[
          ["forward", "Forward"],
          ["reverse", "Reverse"],
          ["random", "Random"],
        ]}
        onChange={(order) => change({ order })}
      />
      <Choice
        label="Animation direction"
        value={m.direction}
        options={[
          ["in", "Entrance"],
          ["out", "Exit"],
        ]}
        onChange={(direction) => change({ direction })}
      />
      <Choice
        label="Text easing"
        value={m.easing}
        options={easing}
        onChange={(easing) => change({ easing })}
      />
      {["depth", "scatter", "spiral"].includes(text.style) && (
        <Numbers
          value={m}
          change={change}
          fields={[
            ["depth", "Depth distance", -0.8, 8],
            ["spread", "Scatter radius (em)", 0, 8],
            ["rotation", "Rotation spread (degrees)", 0, 360, 1],
          ]}
        />
      )}
    </>
  );
}
export function SpatialPassControls({
  pass,
  onChange,
}: {
  pass: VisualPass;
  onChange: (patch: Partial<VisualPass>) => void;
}) {
  if (pass.kind === "repeat") {
    const field = pass.field;
    const change = (patch: Values) =>
      onChange({ field: FieldSchema.parse({ ...field, ...patch }) });
    return (
      <>
        <Toggle
          label="Arrange copies in depth"
          value={!!field}
          onChange={(enabled) =>
            onChange({ field: enabled ? FieldSchema.parse({}) : undefined })
          }
        />
        {field && (
          <>
            <Choice
              label="Depth distribution"
              value={field.mode}
              options={[
                ["volume", "Volume"],
                ["tunnel", "Depth tunnel"],
                ["orbit", "Orbital field"],
              ]}
              onChange={(mode) => change({ mode })}
            />
            <Choice
              label="Repeat source"
              value={field.unit}
              options={[
                ["whole", "Whole element"],
                ["word", "Words (text only)"],
                ["character", "Characters (text only)"],
              ]}
              onChange={(unit) => change({ unit })}
            />
            <Numbers
              value={field}
              change={change}
              fields={[
                ["count", "Object count", 2, 48, 1],
                ["spread", "Spacing", 0.05, 4],
                ["depth", "Depth range", 0.1, 8],
                ["size", "Object size", 0.03, 1.5],
                ["rotation", "Rotation spread", 0, 180, 1],
                ["focus", "Focus distance", -0.9, 8],
                ["blur", "Focus falloff", 0, 30],
              ]}
            />
            <Toggle
              label="Face camera"
              value={field.faceCamera}
              onChange={(faceCamera) => change({ faceCamera })}
            />
          </>
        )}
      </>
    );
  }
  if (pass.kind !== "particles") return null;
  const p = pass.particles;
  const change = (patch: Values) =>
    onChange({ particles: ParticleSchema.parse({ ...p, ...patch }) });
  return (
    <>
      <Toggle
        label="Particles in depth"
        value={!!p}
        onChange={(enabled) =>
          onChange({
            particles: enabled ? ParticleSchema.parse({}) : undefined,
          })
        }
      />
      {p && (
        <>
          <Choice
            label="Particle motion"
            value={p.mode}
            options={[
              ["drift", "Drift"],
              ["burst", "Burst"],
              ["tunnel", "Tunnel"],
              ["vortex", "Vortex"],
            ]}
            onChange={(mode) => change({ mode })}
          />
          <Choice
            label="Emitter shape"
            value={p.emitter}
            options={[
              ["point", "Point"],
              ["box", "Box"],
              ["sphere", "Sphere"],
            ]}
            onChange={(emitter) => change({ emitter })}
          />
          <Choice
            label="Particle shape"
            value={p.shape}
            options={[
              ["dot", "Dot"],
              ["paper", "Paper"],
              ["spark", "Spark"],
            ]}
            onChange={(shape) => change({ shape })}
          />
          <Numbers
            value={p}
            change={change}
            fields={[
              ["count", "Particle count", 4, 256, 1],
              ["lifetime", "Lifetime (seconds)", 0.2, 30],
              ["depth", "Depth spread", 0.1, 8],
              ["velocity", "Velocity", 0, 3],
              ["gravity", "Gravity", -2, 2],
              ["drag", "Drag", 0, 5],
              ["turbulence", "Turbulence", 0, 2],
              ["turbulenceScale", "Turbulence scale", 0.1, 8],
              ["spin", "Spin (degrees/second)", -360, 360, 1],
              ["endSize", "Size at end of life", 0, 3],
              ["trails", "Trail length", 0, 1],
              ["focus", "Focus distance", -0.9, 8],
              ["blur", "Focus falloff", 0, 20],
            ]}
          />
          <Toggle
            label="Clip particles to source alpha"
            value={p.clipToSource}
            onChange={(clipToSource) => change({ clipToSource })}
          />
        </>
      )}
    </>
  );
}
