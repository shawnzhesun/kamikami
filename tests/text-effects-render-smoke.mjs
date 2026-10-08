// Browser raster regression: no local server and no reads/writes to user projects.
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { openBrowser } from "@remotion/renderer";
import { AnimatedText } from "../src/AnimatedText.tsx";
import { EffectSample, effectPosterTime } from "../src/editor/EffectSample.tsx";
import { remotionSceneEffects } from "../src/builtin-effects.ts";
import { makeLayer } from "../src/model.ts";

const effects = remotionSceneEffects.filter((effect) => effect.text);
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
  for (const theme of ["original", "coastal", "daylight", "dusk"]) {
    const cards = effects
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
