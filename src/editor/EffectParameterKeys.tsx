import React from "react";
import type { Layer } from "../model";
import { setAnimated } from "../keyframes";
import { Dropdown } from "./Dropdown";
import { KeyframeField } from "./KeyframeField";
import { localTimeAt } from "./editing";
import { animatableParameters } from "./effect-parameters";

/**
 * Premiere's Effect Controls idea, kept compact: animated effect parameters
 * appear as keyframe rows; others are offered in an "Animate parameter" menu.
 */
export function EffectParameterKeys({
  layer,
  effectId,
  frame,
  fps,
  onChange,
  onSeek,
}: {
  layer: Layer;
  effectId: string;
  frame: number;
  fps: number;
  onChange: (layer: Layer) => void | boolean;
  onSeek: (frame: number) => void;
}) {
  const instance = layer.effects.find((i) => i.effectId === effectId);
  const parameters = animatableParameters(instance?.settings);
  const animated = Object.keys(instance?.keyframes?.parameters ?? {});
  if (!instance || !parameters.length) return null;
  return (
    <div className="effect-parameter-keys">
      {parameters
        .filter((p) => animated.includes(p.path))
        .map((p) => (
          <KeyframeField
            key={p.path}
            layer={layer}
            target={{ kind: "parameter", effectId, path: p.path }}
            label={p.label}
            min={p.min}
            max={p.max}
            step={p.max - p.min <= 2 ? 0.05 : 1}
            frame={frame}
            fps={fps}
            onChange={onChange}
            onSeek={onSeek}
          />
        ))}
      {parameters.length > animated.length && (
        <Dropdown
          label="Animate an effect parameter"
          placeholder="Animate parameter…"
          value=""
          options={parameters
            .filter((p) => !animated.includes(p.path))
            .map((p) => ({ value: p.path, label: p.label }))}
          onChange={(path) =>
            onChange(
              setAnimated(
                layer,
                { kind: "parameter", effectId, path },
                true,
                localTimeAt(layer, frame, fps),
              ),
            )
          }
        />
      )}
    </div>
  );
}
