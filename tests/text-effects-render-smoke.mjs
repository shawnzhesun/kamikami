// Browser raster regression: no local server and no reads/writes to user projects.
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { openBrowser } from "@remotion/renderer";
import { AnimatedText } from "../src/AnimatedText.tsx";
import {
  EffectSample,
  effectPosterTime,
  isTextEffectPreview,
} from "../src/editor/EffectSample.tsx";
import {
  remotionSceneEffects,
  builtinEffects,
  motionEffectFamilies,
  effectVariationPatch,
} from "../src/builtin-effects.ts";
import { EffectSchema, makeLayer } from "../src/model.ts";

const motionPresets = motionEffectFamilies.flatMap((family) => {
  const base = builtinEffects.find((effect) => effect.id === family.id);
  return family.variations.map((preset) =>
    EffectSchema.parse({
      ...base,
      ...effectVariationPatch(base, preset.id),
      id: preset.id,
    }),
  );
});
const effects = [...remotionSceneEffects, ...motionPresets].filter(
  (effect) => effect.text,
);
const gradient = effects.find((effect) => effect.text.kind === "gradient");
const output = await mkdtemp(path.join(tmpdir(), "kamikami-text-render-"));
const browser = await openBrowser("chrome", { logLevel: "error" });
try {
  const page = await browser.newPage({
    context: () => null,
    logLevel: "error",
    indent: false,
    pageIndex: 0,
    onBrowserLog: null,
    onLog: () => {},
  });
  await page.setViewport({ width: 640, height: 180, deviceScaleFactor: 1 });
  const cases = [
    ...effects.map((effect) => [effect]),
    ...effects
      .filter((effect) => !["gradient", "neon"].includes(effect.text.kind))
      .flatMap((effect) => [
        [gradient, effect],
        [effect, gradient],
      ]),
  ];
  for (const recipe of cases)
    for (const time of [0.75, 2]) {
      const layer = {
        ...makeLayer("title", "Title"),
        text: "Title",
        duration: 6,
        effects: recipe.map((effect) => ({
          effectId: effect.id,
          enabled: true,
          amount: 1,
        })),
      };
      const content = renderToStaticMarkup(
        React.createElement(AnimatedText, { layer, effects: recipe, time }),
      );
      await page.goto({
        url:
          "data:text/html," +
          encodeURIComponent(
            `<html><body style="margin:0;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;height:180px;font:bold 64px Georgia;line-height:1.03">${content}</body></html>`,
          ),
        timeout: 10000,
      });
      const shot = await page
        ._client()
        .send("Page.captureScreenshot", { format: "png" });
      const pixels = await page.evaluate(async (png) => {
        const img = new Image();
        img.src = `data:image/png;base64,${png}`;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height).data;
        let visible = 0;
        for (let i = 0; i < data.length; i += 4)
          if (Math.max(data[i], data[i + 1], data[i + 2]) > 60) visible++;
        return visible;
      }, shot.value.data);
      const name = `${recipe.map((effect) => effect.id).join("+")}-${time}`;
      await writeFile(
        path.join(output, name + ".png"),
        Buffer.from(shot.value.data, "base64"),
      );
      assert.ok(pixels > 150, `${name}: only ${pixels} text pixels rendered`);
    }
  const css = await readFile("src/style.css", "utf8");
  // Exercise the shared sample renderer too: whole-element depth, SVG object
  // fields, particle alpha/trails, and glyph fields at their poster times.
  const sampleMarkup = (effect, time) =>
    renderToStaticMarkup(React.createElement(EffectSample, { effect, time }));
  const screenshotSample = async (effect, time) => {
    await page.goto({
      url:
        "data:text/html," +
        encodeURIComponent(
          `<html><style>${css}</style><body style="margin:0;background:#000"><div class="effect-sample ${effect.text || effect.passes?.some((p) => p.field?.unit !== undefined && p.field.unit !== "whole") ? "is-text" : ""}" style="width:320px;height:180px"><div class="effect-sample-art">${sampleMarkup(effect, time)}</div></div></body></html>`,
        ),
      timeout: 10000,
    });
    await page.evaluate(() => document.fonts.ready);
    return (
      await page._client().send("Page.captureScreenshot", { format: "png" })
    ).value.data;
  };
  for (const effect of motionPresets) {
    const time = effectPosterTime(effect);
    const baseline = await screenshotSample(
      {
        ...effect,
        depth: undefined,
        text: undefined,
        passes: [],
        channels: [],
      },
      time,
    );
    const active = await screenshotSample(effect, time);
    if (!isTextEffectPreview(effect))
      assert.notEqual(
        active,
        baseline,
        `${effect.id}: preset did not change rendered pixels`,
      );
    await screenshotSample(effect, time + 2);
    assert.equal(
      await screenshotSample(effect, time),
      active,
      `${effect.id}: seeking changed the frame`,
    );
    await writeFile(
      path.join(output, `motion-${effect.id}.png`),
      Buffer.from(active, "base64"),
    );
  }
  for (const theme of ["original", "coastal", "daylight", "dusk"]) {
    const cards = [
      ...effects,
      ...motionPresets.filter((effect) =>
        effect.passes?.some((pass) => pass.field?.unit === "character"),
      ),
    ]
      .map(
        (effect) =>
          `<div class="effect-card"><div class="effect-sample is-text"><div class="effect-sample-art">${renderToStaticMarkup(React.createElement(EffectSample, { effect, time: effectPosterTime(effect) }))}</div></div></div>`,
      )
      .join("");
    await page.goto({
      url:
        "data:text/html," +
        encodeURIComponent(
          `<html data-theme="${theme}"><style>${css}</style><div class="effects-grid">${cards}</div></html>`,
        ),
      timeout: 10000,
    });
    assert.equal(
      await page.evaluate(
        () =>
          getComputedStyle(document.querySelector(".effect-sample"))
            .backgroundColor,
      ),
      "rgb(23, 35, 46)",
    );
    const shot = await page
      ._client()
      .send("Page.captureScreenshot", { format: "png" });
    await writeFile(
      path.join(output, `previews-${theme}.png`),
      Buffer.from(shot.value.data, "base64"),
    );
  }
  console.log(`Text rendering checks passed. Screenshots: ${output}`);
} finally {
  await browser.close({ silent: true });
}
