import React from "react";
import { ChevronLeft, ChevronRight, Diamond, Timer } from "lucide-react";
import { NumberField } from "./NumberField";
import { Dropdown } from "./Dropdown";
import type { Layer } from "../model";
import {
  adjacentKeyframe,
  getTrack,
  keyframeEasingNames,
  keyframeEasings,
  keyframeIndexAt,
  setAnimated,
  setKeyframeEasing,
  setValueAt,
  toggleKeyframe,
  valueAt,
  type KeyframeTarget,
} from "../keyframes";
import { localTimeAt } from "./editing";

/**
 * Premiere/After Effects-style property row: stopwatch toggles animation;
 * while animated, the value shows the playhead's interpolated value and edits
 * write a keyframe at the playhead. Arrows jump between this row's keyframes.
 */
export function KeyframeField({
  layer,
  target,
  label,
  min,
  max,
  step,
  frame,
  fps,
  onChange,
  onSeek,
}: {
  layer: Layer;
  target: KeyframeTarget;
  label: string;
  min: number;
  max: number;
  step?: number;
  frame: number;
  fps: number;
  onChange: (layer: Layer) => void | boolean;
  onSeek: (frame: number) => void;
}) {
  const local = localTimeAt(layer, frame, fps);
  const track = getTrack(layer, target);
  const animated = !!track?.length;
  const keyIndex = animated ? keyframeIndexAt(layer, target, local) : -1;
  const onKey = keyIndex >= 0;
  const seek = (direction: -1 | 1) => {
    const time = adjacentKeyframe(layer, local, direction, [target]);
    if (time !== undefined)
      onSeek(Math.round(layer.start * fps) + Math.round(time * fps));
  };
  const prev =
    animated && adjacentKeyframe(layer, local, -1, [target]) !== undefined;
  const next =
    animated && adjacentKeyframe(layer, local, 1, [target]) !== undefined;
  return (
    <div className={`keyframe-field ${animated ? "animated" : ""}`}>
      <NumberField
        label={label}
        value={valueAt(layer, target, local)}
        min={min}
        max={max}
        step={step}
        onChange={(n) => onChange(setValueAt(layer, target, n, local))}
      />
      <div
        className="keyframe-controls"
        role="group"
        aria-label={`${label} keyframes`}
      >
        <button
          className="stopwatch"
          aria-pressed={animated}
          title={
            animated
              ? `Stop animating ${label} (keeps the value at the playhead)`
              : `Animate ${label} — adds a keyframe at the playhead`
          }
          aria-label={animated ? `Stop animating ${label}` : `Animate ${label}`}
          onClick={() => onChange(setAnimated(layer, target, !animated, local))}
        >
          <Timer size={13} />
        </button>
        {animated && (
          <>
            <button
              disabled={!prev}
              title="Previous keyframe"
              aria-label={`Previous ${label} keyframe`}
              onClick={() => seek(-1)}
            >
              <ChevronLeft size={13} />
            </button>
            <button
              className={`keyframe-toggle ${onKey ? "on" : ""}`}
              aria-pressed={onKey}
              title={
                onKey
                  ? "Remove keyframe at playhead"
                  : "Add keyframe at playhead"
              }
              aria-label={
                onKey ? `Remove ${label} keyframe` : `Add ${label} keyframe`
              }
              onClick={() => onChange(toggleKeyframe(layer, target, local))}
            >
              <Diamond size={12} />
            </button>
            <button
              disabled={!next}
              title="Next keyframe"
              aria-label={`Next ${label} keyframe`}
              onClick={() => seek(1)}
            >
              <ChevronRight size={13} />
            </button>
          </>
        )}
      </div>
      {onKey && keyIndex < track!.length - 1 && (
        <div className="keyframe-easing">
          <Dropdown
            label={`${label} interpolation to next keyframe`}
            value={track![keyIndex].easing}
            options={keyframeEasings
              .filter(
                (e) => e !== "bezier" || track![keyIndex].easing === "bezier",
              )
              .map((e) => ({ value: e, label: keyframeEasingNames[e] }))}
            onChange={(easing) =>
              onChange(
                setKeyframeEasing(
                  layer,
                  target,
                  local,
                  easing as (typeof keyframeEasings)[number],
                ),
              )
            }
          />
        </div>
      )}
    </div>
  );
}
