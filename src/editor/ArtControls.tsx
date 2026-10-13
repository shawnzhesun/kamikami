import React from "react";
import { artControls, type Art } from "../artwork";
import { Dropdown } from "./Dropdown";
import { NumberField } from "./NumberField";

/** Settings for artwork treatments, driven by each kind's control table. */
export function ArtControls({
  art,
  onChange,
}: {
  art: Art;
  onChange: (patch: Partial<Art>) => void;
}) {
  const c = artControls[art.kind];
  const beat = art.kind !== "slices" || art.timing === "beat";
  return (
    <>
      {c.timing && (
        <label>
          {c.timing}
          <Dropdown
            label="Slice timing"
            value={art.timing}
            options={[
              { value: "beat", label: "Knock on the beat" },
              { value: "in", label: "Slide together (clip start)" },
              { value: "out", label: "Slide apart (clip end)" },
              { value: "constant", label: "Drift continuously" },
            ]}
            onChange={(timing) => onChange({ timing: timing as Art["timing"] })}
          />
        </label>
      )}
      {c.direction && (
        <label>
          {c.direction}
          <Dropdown
            label="Band direction"
            value={art.direction}
            options={[
              { value: "horizontal", label: "Horizontal" },
              { value: "vertical", label: "Vertical" },
            ]}
            onChange={(direction) =>
              onChange({ direction: direction as Art["direction"] })
            }
          />
        </label>
      )}
      {c.tempo && beat && (
        <NumberField
          label={c.tempo}
          value={art.tempo}
          min={30}
          max={240}
          step={1}
          onChange={(tempo) => onChange({ tempo })}
        />
      )}
      {c.count && (
        <NumberField
          label={c.count}
          value={art.count}
          min={art.kind === "slices" ? 2 : 1}
          max={art.kind === "trail" ? 4 : art.kind === "slices" ? 12 : 24}
          step={1}
          onChange={(count) => onChange({ count: Math.round(count) })}
        />
      )}
      {c.strength && (
        <NumberField
          label={c.strength}
          value={art.strength}
          min={0}
          max={1}
          step={0.05}
          onChange={(strength) => onChange({ strength })}
        />
      )}
      {c.distance && (
        <NumberField
          label={c.distance}
          value={Math.round(art.distance * 1000) / 10}
          min={0}
          max={100}
          step={0.1}
          onChange={(percent) => onChange({ distance: percent / 100 })}
        />
      )}
      {c.angle && (
        <NumberField
          label={c.angle}
          value={art.angle}
          min={-180}
          max={180}
          step={1}
          onChange={(angle) => onChange({ angle })}
        />
      )}
      {c.seconds && (
        <NumberField
          label={c.seconds}
          value={art.seconds}
          min={0.02}
          max={30}
          step={0.01}
          onChange={(seconds) => onChange({ seconds })}
        />
      )}
      {c.speed && (art.kind !== "slices" || art.timing === "constant") && (
        <NumberField
          label={c.speed}
          value={art.speed}
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
            value={art.color}
            onChange={(event) => onChange({ color: event.target.value })}
          />
        </label>
      )}
      {c.secondary && (
        <label>
          {c.secondary}
          <input
            type="color"
            value={art.secondary}
            onChange={(event) => onChange({ secondary: event.target.value })}
          />
        </label>
      )}
      {beat && c.tempo && (
        <small className="muted">
          Beats count from the project start, so elements on the same tempo hit
          together.
        </small>
      )}
    </>
  );
}
