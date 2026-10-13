// Browser raster check for kinetic type: contact sheets of every kinetic card
// over time, set in the bundled display faces. No server, no user files.
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { openBrowser } from "@remotion/renderer";
import { AnimatedText, TextMetricsContext } from "../src/AnimatedText.tsx";
import {
  kineticEffects,
  layoutEffects,
  lookEffects,
} from "../src/builtin-effects.ts";
import { isLayoutKind } from "../src/text-layouts.ts";
import { isKineticKind, kineticRole } from "../src/kinetic-type.ts";
import { makeLayer } from "../src/model.ts";
import { builtinFonts } from "../src/font-assets.ts";

const TEXT = "Midnight\nTrain";
// Layouts arrange a whole phrase, so they get a lyric line.
const LYRIC = "I remember\nthe color of dawn";
const faces = [
  "builtin-dela-gothic-one",
  "builtin-zen-old-mincho",
  "builtin-m-plus-rounded-1c",
  "builtin-shippori-mincho-b1",
  "builtin-mochiy-pop-one",
  "builtin-klee-one",
].map((id) => builtinFonts.find((f) => f.id === id));
const face = (i) => faces[i % faces.length];
const fontFaceCss = faces
  .map((f) => {
    const v = f.variants[0];
    const src = pathToFileURL(path.resolve("public" + v.src)).href;
    return `@font-face{font-family:"K-${f.id}";src:url("${src}");font-weight:${v.weightMin};}`;
  })
  .join("");
const timesFor = (effect) => {
  const k = effect.text.kind;
  if (k === "swap") return [0.2, 0.7, 1.7, 3.1, 3.6];
  if (k === "seesaw") return [0.2, 0.45, 0.6, 0.95, 1.1];
  if (isLayoutKind(k)) {
    const s = effect.text.seconds;
    return [0.02, s * 0.3, s * 0.6, s * 0.9, s + 0.5];
  }
  if (!isKineticKind(k)) return [0.1, 0.35, 0.7, 1.4, 3];
  const role = kineticRole(effect.text.kind);
  const s = effect.text.seconds;
  if (role === "hold") return [0.2, 1.6, 1.85, 2.1, 2.4];
  if (role === "exit")
    return [6 - s - 0.1, 6 - s * 0.7, 6 - s * 0.45, 6 - s * 0.2, 5.98];
  return [0.02, s * 0.25, s * 0.5, s * 0.75, s + 0.2];
};
const card = (id) =>
  [...kineticEffects, ...lookEffects, ...layoutEffects].find(
    (effect) => effect.id === id,
  );
// Single cards, then art-directed stacks: motion + paint + decoration.
const recipes = [
  ...kineticEffects.map((effect) => ({ name: effect.name, effects: [effect] })),
  ...lookEffects.map((effect) => ({ name: effect.name, effects: [effect] })),
  ...layoutEffects.map((effect) => ({
    name: effect.name,
    effects: [effect],
    text: LYRIC,
  })),
  ...[
    ["kinetic-flash", "look-ghosts", "look-keyline"],
    ["kinetic-slam", "look-extrude", "look-burst"],
    ["kinetic-hinge", "look-word-plates", "look-label"],
    ["kinetic-decode", "look-brackets", "look-ticker"],
    ["kinetic-spring", "look-chrome", "look-reflection"],
    ["kinetic-push", "look-neon", "look-rules"],
  ].map((ids) => ({
    name: ids.map((id) => card(id).name).join(" + "),
    effects: ids.map(card),
  })),
  // Layouts under motions and treatments.
  ...[
    ["layout-stack", "look-keyline"],
    ["layout-keyword", "kinetic-spring"],
    ["layout-giant", "look-ghosts"],
    ["layout-swap", "look-word-plates"],
  ].map((ids) => ({
    name: ids.map((id) => card(id).name).join(" + "),
    effects: ids.map(card),
    text: LYRIC,
  })),
];
const output = await mkdtemp(path.join(tmpdir(), "kamikami-kinetic-render-"));
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
  const sheet = path.join(output, "sheet.html");
  // Measure every line prefix in each face, as the editor's canvas metrics do.
  await writeFile(
    sheet,
    `<html><style>${fontFaceCss}</style><body></body></html>`,
  );
  await page.goto({ url: pathToFileURL(sheet).href, timeout: 10000 });
  const prefixes = [
    ...new Set(
      [TEXT, LYRIC]
        .flatMap((text) => text.split("\n"))
        .flatMap((line) =>
          [...line].map((_, i) => line.slice(0, i + 1)).concat(""),
        ),
    ),
  ];
  const widths = await page.evaluate(
    async (families, prefixes) => {
      const ctx = document.createElement("canvas").getContext("2d");
      const out = {};
      for (const [family, weight] of families) {
        await document.fonts.load(`${weight} 100px "${family}"`);
        ctx.font = `${weight} 100px "${family}"`;
        out[family] = Object.fromEntries(
          prefixes.map((p) => [p, ctx.measureText(p).width / 100]),
        );
      }
      return out;
    },
    faces.map((f) => [`K-${f.id}`, f.variants[0].weightMin]),
    prefixes,
  );
  const rows = 12;
  for (let start = 0, n = 0; start < recipes.length; start += rows, n++) {
    const cards = recipes.slice(start, start + rows);
    const html = cards
      .map(({ name, effects, text = TEXT }, r) => {
        const effect = effects[0];
        const f = face(start + r);
        const family = `K-${f.id}`;
        const table = widths[family];
        const measure = (s) => table[s] ?? 0.6 * s.length;
        const cells = timesFor(effect)
          .map((time) => {
            const layer = {
              ...makeLayer("title", "Title"),
              text,
              duration: 6,
              color: "#fff4e4",
              effects: effects.map((e) => ({
                effectId: e.id,
                enabled: true,
                amount: 1,
              })),
            };
            const markup = renderToStaticMarkup(
              React.createElement(
                TextMetricsContext.Provider,
                { value: measure },
                React.createElement(AnimatedText, {
                  layer,
                  effects,
                  time,
                }),
              ),
            );
            return `<div class="cell"><div class="t" style="${text === LYRIC ? "font-size:22px;letter-spacing:-1px;" : ""}font-family:'${family}';font-weight:${f.variants[0].weightMin}">${markup}</div><i>${time.toFixed(2)}s</i></div>`;
          })
          .join("");
        return `<div class="row"><b>${name}<br><small>${f.family}</small></b>${cells}</div>`;
      })
      .join("");
    await writeFile(
      sheet,
      `<html><style>${fontFaceCss}
      body{margin:0;background:#15181d;color:#fff;font:12px sans-serif}
      .row{display:flex;height:150px;border-bottom:1px solid #333}
      .row>b{width:150px;padding:10px;font-weight:600}
      .cell{position:relative;width:300px;display:flex;align-items:center;justify-content:center;overflow:hidden;border-left:1px solid #2a2f37}
      .cell i{position:absolute;right:6px;bottom:4px;color:#777;font-style:normal}
      .t{font-size:40px;line-height:1.03;white-space:pre-wrap;letter-spacing:-4px}
      </style><body>${html}</body></html>`,
    );
    await page.setViewport({
      width: 1650,
      height: rows * 151,
      deviceScaleFactor: 1,
    });
    await page.goto({ url: pathToFileURL(sheet).href, timeout: 10000 });
    await page.evaluate(() => document.fonts.ready);
    // The settled column (entrances) and the first column (exits/holds) show the full text.
    const blank = await page.evaluate(() =>
      [...document.querySelectorAll(".row")].map((row, i) => {
        const cells = row.querySelectorAll(".cell .t");
        const rest = cells[cells.length - 1].getBoundingClientRect();
        return { i, width: rest.width };
      }),
    );
    for (const { i, width } of blank)
      assert.ok(width > 40, `${cards[i].name}: settled text has no width`);
    const shot = await page
      ._client()
      .send("Page.captureScreenshot", { format: "png" });
    await writeFile(
      path.join(output, `kinetic-${n + 1}.png`),
      Buffer.from(shot.value.data, "base64"),
    );
  }
  console.log(`Kinetic rendering checks passed. Screenshots: ${output}`);
} finally {
  await browser.close({ silent: true });
}
