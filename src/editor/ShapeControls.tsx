import React from "react";
import type { Layer } from "../model";
import { shapeKinds, type Shape, type ShapeKind } from "../shapes";
import { Dropdown } from "./Dropdown";
import { NumberField } from "./NumberField";

const kindLabels: Record<ShapeKind, string> = {
  rectangle: "Rectangle",
  ellipse: "Ellipse",
  polygon: "Polygon",
  star: "Star",
  arrow: "Arrow",
  heart: "Heart",
};

/** Inspector fields for a shape element: geometry, fill and outline. */
export function ShapeControls({
  layer,
  onShape,
  onColor,
}: {
  layer: Layer;
  /** Merged into the element's current shape. */
  onShape: (patch: Partial<Shape>, group?: string) => void;
  onColor: (color: string) => void;
}) {
  const shape = layer.shape!;
  const outline = shape.stroke ? (shape.strokeWidth ?? 0) : 0;
  return (
    <>
      <div className="section-line">
        <span>SHAPE</span>
      </div>
      <label>
        Shape
        <Dropdown
          label="Shape"
          value={shape.kind}
          onChange={(kind) =>
            onShape({
              kind: kind as ShapeKind,
              ...((kind === "polygon" || kind === "star") && !shape.sides
                ? { sides: kind === "star" ? 5 : 6 }
                : {}),
            })
          }
          options={shapeKinds.map((kind) => ({
            value: kind,
            label: kindLabels[kind],
          }))}
        />
      </label>
      <div className="field-row">
        <NumberField
          label="Width"
          value={shape.width}
          min={2}
          max={8192}
          onChange={(width) => onShape({ width })}
        />
        <NumberField
          label="Height"
          value={shape.height}
          min={2}
          max={8192}
          onChange={(height) => onShape({ height })}
        />
      </div>
      {shape.kind === "rectangle" && (
        <NumberField
          label="Corner radius"
          value={shape.radius ?? 0}
          min={0}
          max={4096}
          onChange={(radius) => onShape({ radius })}
        />
      )}
      {(shape.kind === "polygon" || shape.kind === "star") && (
        <div className="field-row">
          <NumberField
            label={shape.kind === "star" ? "Points" : "Sides"}
            value={shape.sides ?? (shape.kind === "star" ? 5 : 6)}
            min={3}
            max={24}
            onChange={(sides) => onShape({ sides: Math.round(sides) })}
          />
          {shape.kind === "star" && (
            <NumberField
              label="Inner radius"
              value={shape.innerRadius ?? 0.45}
              min={0.1}
              max={0.95}
              step={0.05}
              onChange={(innerRadius) => onShape({ innerRadius })}
            />
          )}
        </div>
      )}
      <div className="field-row shape-paint">
        <label>
          <span className="shape-paint-heading">
            <input
              type="checkbox"
              checked={shape.filled !== false}
              aria-label="Fill"
              onChange={(e) => onShape({ filled: e.target.checked })}
            />
            Fill
          </span>
          <input
            type="color"
            aria-label="Fill color"
            value={layer.color}
            disabled={shape.filled === false}
            onChange={(e) => onColor(e.target.value)}
          />
        </label>
        <label>
          Outline
          <input
            type="color"
            aria-label="Outline color"
            value={shape.stroke ?? layer.color}
            onChange={(e) =>
              onShape(
                {
                  stroke: e.target.value,
                  ...(outline ? {} : { strokeWidth: 8 }),
                },
                `shape:${layer.id}:stroke`,
              )
            }
          />
        </label>
      </div>
      <NumberField
        label="Outline width"
        value={outline}
        min={0}
        max={400}
        onChange={(strokeWidth) =>
          onShape({
            strokeWidth,
            ...(shape.stroke ? {} : { stroke: layer.color }),
          })
        }
      />
    </>
  );
}
