// An isolated browser fixture: no model requests or writes to the user's workspace.
import assert from "node:assert/strict";
import { writeFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { openBrowser } from "@remotion/renderer";
import { initialProject, validateProject } from "../src/model.ts";
import { FontLibrary } from "../server/font-library.ts";
import { EffectLibrary } from "../server/effect-library.ts";

const fontData = await mkdtemp(path.join(tmpdir(), "kamikami-font-ui-"));
const fontLibrary = new FontLibrary(fontData, path.resolve("public"));
const effectLibrary = new EffectLibrary(fontData);

let project = structuredClone(initialProject);
const assets = [
  {
    src: "/media/fixture.png",
    name: "Sample image",
    type: "image",
    size: 68,
    width: 1,
    height: 1,
    duration: null,
    peaks: [],
    missing: false,
  },
];
const fixture = {
  name: "isolated-editor-fixture",
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url === "/media/fixture.png") {
        res.setHeader("Content-Type", "image/png");
        res.end(
          Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
            "base64",
          ),
        );
        return;
      }
      if (req.url?.startsWith("/fonts/imported/")) {
        try {
          res.setHeader("Content-Type", "font/ttf");
          res.end(
            await readFile(
              path.join(fontData, "fonts", path.basename(req.url)),
            ),
          );
        } catch {
          res.statusCode = 404;
          res.end();
        }
        return;
      }
      if (!req.url?.startsWith("/api/")) {
        next();
        return;
      }
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const bytes = Buffer.concat(chunks);
      const body = bytes.toString();
      let result = {};
      if (req.url === "/api/health")
        result = {
          ok: true,
          effectEngine: "kamikami-visual-v5",
          projectVersion: 3,
          effectLibraryVersion: 2,
        };
      else if (req.url === "/api/fonts/import") {
        const request = new Request("http://localhost/api/fonts/import", {
          method: "POST",
          headers: { "Content-Type": req.headers["content-type"] },
          body: bytes,
        });
        const form = await request.formData();
        const file = form.get("file");
        result = await fontLibrary.import(
          Buffer.from(await file.arrayBuffer()),
          file.name,
        );
      } else if (req.url === "/api/fonts") result = await fontLibrary.list();
      else if (req.url === "/api/project") {
        if (req.method === "PUT") project = validateProject(JSON.parse(body));
        result = project;
      } else if (req.url.startsWith("/api/media")) result = assets;
      else if (req.url === "/api/effects/save")
        result = await effectLibrary.save(JSON.parse(body));
      else if (req.url === "/api/effects/delete")
        result = await effectLibrary.delete(JSON.parse(body).effectId);
      else if (req.url === "/api/effects/sync")
        result = await effectLibrary.syncProjectEffects(JSON.parse(body));
      else if (req.url === "/api/effects/import")
        result = await effectLibrary.import(JSON.parse(body));
      else if (req.url === "/api/effects") result = await effectLibrary.list();
      else if (req.url === "/api/editor/poll")
        result = { primary: true, requests: [] };
      else if (req.url === "/api/assistant")
        result = {
          configured: false,
          name: "Test",
          baseURL: "https://api.openai.com/v1",
          apiMode: "responses",
          model: "",
          messages: [],
          active: null,
          confirmation: null,
        };
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    });
  },
};
const server = await createServer({
  configFile: false,
  plugins: [fixture, react()],
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  logLevel: "error",
});
await server.listen();
let browser;
const output = await mkdtemp(path.join(tmpdir(), "kamikami-keyframe-ui-"));
try {
  browser = await openBrowser("chrome", { logLevel: "error" });
  const page = await browser.newPage({
    context: () => null,
    logLevel: "error",
    indent: false,
    pageIndex: 0,
    onBrowserLog: null,
    onLog: () => {},
  });
  const errors = [];
  page.on("error", (e) => errors.push(String(e)));
  await page.evaluateOnNewDocument(() => {
    // Model native file dialogs without touching the user's files.
    window.kamikamiProjectFiles = {
      info: async () => ({
        file: localStorage.getItem("fixture-project-file")
          ? { name: "fixture.json" }
          : null,
      }),
      open: async () => null,
      accept: async () => ({ name: "fixture.json" }),
      save: async (text) => {
        localStorage.setItem("fixture-project-file", text);
        return { name: "fixture.json" };
      },
    };
  });
  await page.setViewport({ width: 1440, height: 980, deviceScaleFactor: 1 });
  await page.goto({ url: "http://127.0.0.1:5174", timeout: 30000 });
  const wait = async (fn) => {
    const end = Date.now() + 10000;
    while (!(await fn())) {
      if (Date.now() > end) throw new Error("UI condition timed out");
      await new Promise((r) => setTimeout(r, 30));
    }
  };
  const exists = (selector) =>
    page.evaluate((s) => !!document.querySelector(s), selector);
  const click = (selector) =>
    page.evaluate((s) => {
      const e = document.querySelector(s);
      if (!e) throw new Error(`Missing ${s}`);
      e.click();
    }, selector);
  const text = () => page.evaluate(() => document.body.innerText);
  const fill = (selector, value) =>
    page.evaluate(
      (s, v) => {
        const e = document.querySelector(s);
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        ).set.call(e, v);
        e.dispatchEvent(new Event("input", { bubbles: true }));
      },
      selector,
      value,
    );
  const save = async () => {
    // The renderer's browser profile can keep localStorage between runs.
    await page.evaluate(() =>
      localStorage.setItem("fixture-project-file", "{}"),
    );
    await page.evaluate(() =>
      [...document.querySelectorAll("header button")]
        .find((e) => e.textContent.trim() === "Save")
        .click(),
    );
    await wait(() =>
      exists(
        'header button[title="Save to fixture.json (⌘/Ctrl S)"]:not(:disabled)',
      ),
    );
    await wait(() =>
      page.evaluate(
        () => localStorage.getItem("fixture-project-file") !== "{}",
      ),
    );
  };
  await wait(() => exists(".media-card"));
  const saved = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("fixture-project-file")),
    );
  const pressEnter = (selector) =>
    page.evaluate((s) => {
      const e = document.querySelector(s);
      e.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      e.blur();
    }, selector);
  const xField = '.keyframe-field input[type="number"]';

  // Select the title, start animating X at frame 0.
  // Clips select on pointerdown or Enter; use the keyboard path.
  await page.evaluate(() => {
    const clip = document.querySelector('.clip[data-element-id="title"]');
    clip.focus();
    clip.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
  });
  await wait(() =>
    page.evaluate(() =>
      [...document.querySelectorAll("label")].some(
        (l) =>
          l.textContent.startsWith("Text") &&
          l.querySelector("textarea")?.value.startsWith("AFTER"),
      ),
    ),
  );
  await wait(() => exists('button[aria-label="Animate X position"]'));
  await click('button[aria-label="Animate X position"]');
  await wait(() => exists('button[aria-label="Stop animating X position"]'));
  // Move one second and edit X: auto-key creates the second keyframe.
  await click('button[title="Forward one second"]');
  await wait(() => exists('button[aria-label="Add X position keyframe"]'));
  await page.evaluate((s) => document.querySelector(s).focus(), xField);
  await fill(xField, "100");
  await pressEnter(xField);
  try {
    await wait(() => exists('button[aria-label="Remove X position keyframe"]'));
  } catch (e) {
    console.log(
      await page.evaluate(() => [
        document.querySelector("footer").innerText,
        [...document.querySelectorAll(".keyframe-field input")].map(
          (i) => i.value + " " + i.getAttribute("aria-invalid"),
        ),
        document.querySelector(".keyframe-field")?.innerText,
      ]),
    );
    throw e;
  }
  await save();
  let data = await saved();
  assert.equal(data.version, 3);
  const title = data.layers.find((l) => l.id === "title");
  assert.deepEqual(
    title.keyframes.x.map((k) => [k.time, k.value]),
    [
      [0, -470],
      [1, 100],
    ],
  );
  // Two timeline diamonds; the previous-key button seeks back.
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelectorAll(
          '.clip[data-element-id="title"] .clip-keyframe',
        ).length,
    ),
    2,
  );
  await click('button[aria-label="Previous X position keyframe"]');
  await wait(() =>
    page.evaluate((s) => document.querySelector(s).value === "-470", xField),
  );
  // Easing on the first key, then a screenshot of the inspector for review.
  assert.ok(await exists(".keyframe-easing"));
  const shot = await page
    ._client()
    .send("Page.captureScreenshot", { format: "png" });
  await writeFile(
    path.join(output, "keyframes.png"),
    Buffer.from(shot.value.data, "base64"),
  );
  console.log("screenshot", path.join(output, "keyframes.png"));
  // Stopwatch off keeps the playhead value and removes the animation.
  await click('button[aria-label="Stop animating X position"]');
  await save();
  data = await saved();
  assert.equal(data.version, 2);
  assert.equal(data.layers.find((l) => l.id === "title").keyframes, undefined);
  assert.deepEqual(errors, []);
  console.log("Keyframe UI smoke passed");
} finally {
  await browser?.close({ silent: true });
  await server.close();
  await rm(fontData, { recursive: true, force: true });
}
