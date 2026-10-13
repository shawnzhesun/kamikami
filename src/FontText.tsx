import { AnimatedText, TextMetricsContext } from "./AnimatedText";
import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { canvasMeasure } from "./kinetic-type";
import { flushSync } from "react-dom";
import { getRemotionEnvironment, useDelayRender } from "remotion";
import { fontCSS, resolveFont } from "./font-assets";
import { FONT_IMPORT_EVENT, loadFontAsset } from "./font-loading";
import { fontStack } from "./fonts";
import type { Layer, Project } from "./model";

export function FontText({
  layer,
  project,
  mediaOrigin,
  letterSpacing = 0,
  time = 0,
}: {
  layer: Layer;
  project: Project;
  mediaOrigin: string;
  letterSpacing?: number;
  time?: number;
}) {
  const font = resolveFont(layer.fontId, project.fonts);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const imported = (event: Event) => {
      if ((event as CustomEvent<string>).detail === layer.fontId)
        setRetry((n) => n + 1);
    };
    window.addEventListener(FONT_IMPORT_EVENT, imported);
    return () => window.removeEventListener(FONT_IMPORT_EVENT, imported);
  }, [layer.fontId]);
  const weight = layer.fontWeight ?? 800,
    style = layer.fontStyle ?? "normal";
  const key = JSON.stringify([
    layer.fontId,
    font,
    weight,
    style,
    mediaOrigin,
    retry,
  ]);
  const [loaded, setLoaded] = useState("");
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  useLayoutEffect(() => {
    if (!layer.fontId) return;
    let active = true;
    const handle = delayRender(`Loading font ${font?.family ?? layer.fontId}`);
    const loading = font
      ? loadFontAsset(font, weight, style, mediaOrigin)
      : Promise.reject(
          new Error(
            "Missing font definition. Choose a replacement in the Text inspector.",
          ),
        );
    loading.then(
      () => {
        if (active)
          flushSync(() => {
            setLoaded(key);
            setFailure(null);
          });
        continueRender(handle);
      },
      (error: Error) => {
        if (active) {
          setFailure({ key, message: error.message });
          if (getRemotionEnvironment().isRendering) cancelRender(error);
        }
        continueRender(handle);
      },
    );
    return () => {
      active = false;
      continueRender(handle);
    };
  }, [key, delayRender, continueRender, cancelRender]);
  const pending = !!layer.fontId && loaded !== key;
  const error = failure?.key === key ? failure.message : "";
  const family = font
    ? fontCSS(font, weight, style)
    : fontStack(layer.fontFamily);
  const tracking = (layer.fontSize > 50 ? -4 : 4) + letterSpacing;
  // Kinetic type positions letters from real metrics once the face is loaded.
  const measure = useMemo(
    () =>
      pending
        ? null
        : canvasMeasure(
            `${style} ${weight} 100px ${family}`,
            tracking / layer.fontSize,
          ),
    [pending, style, weight, family, tracking, layer.fontSize],
  );
  return (
    <>
      <div
        data-layer-content={layer.id}
        data-font-status={error ? "error" : pending ? "loading" : "ready"}
        style={{
          color: layer.color,
          fontFamily: family,
          fontSize: layer.fontSize,
          fontWeight: weight,
          fontStyle: style,
          fontSynthesis: layer.fontId ? "none" : undefined,
          visibility: pending ? "hidden" : "visible",
          letterSpacing: tracking,
          lineHeight: 1.03,
          whiteSpace: "pre-wrap",
          textAlign: "left",
          textShadow: "0 4px 40px #0008",
        }}
      >
        <TextMetricsContext.Provider value={measure}>
          <AnimatedText layer={layer} effects={project.effects} time={time} />
        </TextMetricsContext.Provider>
      </div>
      {pending && (
        <div
          role={error ? "alert" : "status"}
          style={{
            position: "absolute",
            fontFamily: "Arial, sans-serif",
            fontSize: 26,
            maxWidth: 800,
            padding: 20,
            color: "#fff",
            background: "#171717e8",
          }}
        >
          {error || `Loading ${font?.family ?? "font"}…`}
        </div>
      )}
    </>
  );
}
