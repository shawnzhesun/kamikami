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

const fontData = await mkdtemp(path.join(tmpdir(), "kamikami-font-ui-"));
const fontLibrary = new FontLibrary(fontData, path.resolve("public"));

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
      if (req.url === "/api/fonts/import") {
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
      else if (req.url.startsWith("/api/effects")) result = [];
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
const output = await mkdtemp(path.join(tmpdir(), "kamikami-timeline-ui-"));
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
    await page.evaluate(() =>
      [...document.querySelectorAll("header button")]
        .find((e) => e.textContent.trim() === "Save")
        .click(),
    );
    await wait(() => exists("header .project-name"));
    await new Promise((r) => setTimeout(r, 100));
  };
  await wait(() => exists(".media-card"));
  assert.equal(await exists(".new-layer-drop"), false);
  assert.equal(await exists(".preview-caption"), false);
  assert.ok(!(await text()).includes("FRAME-ACCURATE PREVIEW"));
  await page.evaluate(() =>
    document
      .querySelector('[data-element-id="title"]')
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
  );
  assert.equal(
    await page.evaluate(() =>
      document
        .querySelector('[data-element-id="title"]')
        .getAttribute("aria-pressed"),
    ),
    "true",
  );
  const beforeFont = structuredClone(project);
  assert.equal(await exists("select, datalist"), false);
  assert.equal(await exists('button[aria-label="Font family"]'), true);
  await click('button[aria-label="Font family"]');
  await wait(() => exists('button[aria-label="Use Georgia"]'));
  await click('button[aria-label="Use Georgia"]');
  await save();
  assert.equal(
    project.layers.find((e) => e.id === "title").fontFamily,
    "Georgia",
  );
  assert.match(
    await page.evaluate(
      () =>
        getComputedStyle(document.querySelector('[data-layer-content="title"]'))
          .fontFamily,
    ),
    /Georgia/,
  );
  await click('header button[aria-label="Undo"]');
  await save();
  assert.deepEqual(project, beforeFont);
  await click('header button[aria-label="Redo"]');
  await save();
  assert.equal(
    project.layers.find((e) => e.id === "title").fontFamily,
    "Georgia",
  );
  await page.goto({ url: "http://127.0.0.1:5174", timeout: 30000 });
  await wait(() => exists(".media-card"));
  assert.match(
    await page.evaluate(
      () =>
        getComputedStyle(document.querySelector('[data-layer-content="title"]'))
          .fontFamily,
    ),
    /Georgia/,
  );
  await page.evaluate(() =>
    document
      .querySelector('[data-element-id="title"]')
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
  );
  await click('button[aria-label="Font family"]');
  await click('button[aria-label="Use Arial"]');
  await save();

  // Bundled font previews, favorites, keyboard menus, font import and persistence.
  await click('button[aria-label="Font family"]');
  await fill('input[aria-label="Search fonts"]', "Host Grotesk");
  await wait(() =>
    exists('button[aria-label="Use Host Grotesk"]:not(:disabled)'),
  );
  assert.match(
    await page.evaluate(
      () =>
        getComputedStyle(document.querySelector(".font-option-preview"))
          .fontFamily,
    ),
    /KamiKami-builtin-host-grotesk/,
  );
  await click('button[aria-label="Favorite Host Grotesk"]');
  await click('button[aria-label="Use Host Grotesk"]');
  await wait(
    async () =>
      await page.evaluate(
        () =>
          document.querySelector('[data-layer-content="title"]').dataset
            .fontStatus === "ready",
      ),
  );
  await save();
  assert.equal(
    project.layers.find((e) => e.id === "title").fontId,
    "builtin-host-grotesk",
  );
  await click('[role="combobox"][aria-label="Font weight"]');
  await page.evaluate(() => {
    const control = document.querySelector(
      '[role="combobox"][aria-label="Font weight"]',
    );
    control.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
    );
  });
  await page.evaluate(() =>
    document
      .querySelector('[role="combobox"][aria-label="Font weight"]')
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
  );
  await save();
  assert.equal(project.layers.find((e) => e.id === "title").fontWeight, 300);
  await click('button[aria-label="Font family"]');
  await click('[role="combobox"][aria-label="Font category"]');
  await page.evaluate(() =>
    [...document.querySelectorAll('[role="option"]')]
      .find((e) => e.textContent.trim() === "Favorites")
      .click(),
  );
  assert.equal(await exists(".font-picker"), true);
  assert.equal(await exists('button[aria-label="Use Host Grotesk"]'), true);
  await page.evaluate(async () => {
    const bytes = await (
      await fetch("/fonts/builtin/Rubik-Regular.ttf")
    ).arrayBuffer();
    const data = new DataTransfer();
    data.items.add(new File([bytes], "MyRubik.ttf", { type: "font/ttf" }));
    const input = document.querySelector(
      'input[aria-label="Import font files"]',
    );
    input.files = data.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await wait(async () => !(await exists(".font-picker")));
  await wait(
    async () =>
      await page.evaluate(
        () =>
          document.querySelector('[data-layer-content="title"]').dataset
            .fontStatus === "ready",
      ),
  );
  await save();
  const customFont = project.layers.find((e) => e.id === "title").fontId;
  assert.match(customFont, /^custom-/);
  assert.equal(project.fonts[0].family, "Rubik");
  await page.goto({ url: "http://127.0.0.1:5174", timeout: 30000 });
  await wait(() => exists(".media-card"));
  await wait(
    async () =>
      await page.evaluate(
        () =>
          document.querySelector('[data-layer-content="title"]').dataset
            .fontStatus === "ready",
      ),
  );
  assert.match(
    await page.evaluate(
      () =>
        getComputedStyle(document.querySelector('[data-layer-content="title"]'))
          .fontFamily,
    ),
    /KamiKami-custom-/,
  );
  await page.evaluate(() =>
    document
      .querySelector('[data-element-id="title"]')
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
  );
  await click('button[aria-label="Font family"]');
  await click('button[aria-label="Use Arial"]');
  await save();
  await page.evaluate(() =>
    document
      .querySelector(".preview-area")
      .dispatchEvent(
        new PointerEvent("pointerdown", { button: 0, bubbles: true }),
      ),
  );
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelectorAll('[data-element-id][aria-pressed="true"]')
          .length,
    ),
    0,
  );
  assert.equal(await exists(".canvas-selection"), false);

  const beforeTheme = structuredClone(project);
  await click('button[aria-label="Choose app theme"]');
  assert.equal(
    await page.evaluate(
      () => document.querySelectorAll(".theme-option").length,
    ),
    4,
  );
  assert.equal(
    await page.evaluate(
      () => document.querySelectorAll(".theme-swatches > span").length,
    ),
    16,
  );
  for (const id of ["coastal", "daylight", "dusk", "original"]) {
    await click(`input[name="app-theme"][value="${id}"]`);
    assert.equal(
      await page.evaluate(() => document.documentElement.dataset.theme),
      id,
    );
    assert.equal(
      await page.evaluate(() => localStorage.getItem("kamikami-theme")),
      id,
    );
    const image = await page
      ._client()
      .send("Page.captureScreenshot", { format: "png" });
    await writeFile(
      path.join(output, `theme-${id}.png`),
      Buffer.from(image.value.data, "base64"),
    );
  }
  await click('input[name="app-theme"][value="dusk"]');
  await page.evaluate(() =>
    [...document.querySelectorAll("dialog[open] button")]
      .find((e) => e.textContent === "Done")
      .click(),
  );
  await page.goto({ url: "http://127.0.0.1:5174", timeout: 30000 });
  await wait(() => exists(".media-card"));
  assert.equal(
    await page.evaluate(() => document.documentElement.dataset.theme),
    "dusk",
  );
  assert.equal(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).colorScheme,
    ),
    "dark",
  );
  assert.deepEqual(project, beforeTheme);
  await click('button[aria-label="Choose app theme"]');
  await click('input[name="app-theme"][value="original"]');
  await page.evaluate(() =>
    [...document.querySelectorAll("dialog[open] button")]
      .find((e) => e.textContent === "Done")
      .click(),
  );

  assert.ok(!(await text()).includes("Add at playhead"));
  assert.ok(!(await text()).includes("Analyze"));
  assert.equal(
    await page.evaluate(() => document.querySelector(".media-card").draggable),
    true,
  );
  assert.equal(
    await page.evaluate(() =>
      document.querySelector(".inspector").innerText.includes("PROJECT"),
    ),
    false,
  );
  await click(".project-name");
  await wait(() => exists("dialog[open] input"));
  await fill("dialog[open] input", "Cancelled name");
  await click('dialog[open] button[type="button"]');
  assert.equal(project.name, initialProject.name);
  await click(".project-name");
  await fill("dialog[open] input", "Timeline fixture");
  await click('dialog[open] button[type="submit"]');
  await save();
  assert.equal(project.name, "Timeline fixture");
  await click('button[aria-label="New layer"]');
  await fill("dialog[open] input", "Montage");
  await click('dialog[open] button[type="submit"]');
  await save();
  const track = project.tracks.find((t) => t.name === "Montage");
  assert.ok(track);
  assert.equal(project.layers.length, 3);
  const drop = async (time) => {
    await page.evaluate(
      (id, time) => {
        const card = document.querySelector(".media-card");
        const lane = document.querySelector(
          `[data-track-id="${id}"] .track-lane`,
        );
        lane.scrollIntoView({ block: "nearest" });
        const transfer = new DataTransfer();
        card.dispatchEvent(
          new DragEvent("dragstart", { bubbles: true, dataTransfer: transfer }),
        );
        const rect = lane.getBoundingClientRect();
        const options = {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
          clientX: rect.left + (rect.width * time) / 15,
          clientY: rect.top + 20,
        };
        lane.dispatchEvent(new DragEvent("dragover", options));
        lane.dispatchEvent(new DragEvent("drop", options));
        card.dispatchEvent(
          new DragEvent("dragend", { bubbles: true, dataTransfer: transfer }),
        );
      },
      track.id,
      time,
    );
    if (time === 2) assert.match(await text(), /occupied/);
    await save();
  };
  await drop(5);
  const first = project.layers.find((e) => e.trackId === track.id);
  assert.ok(first);
  assert.equal(first.start, 5);
  await drop(0);
  assert.deepEqual(
    project.layers
      .filter((e) => e.trackId === track.id)
      .map((e) => [e.start, e.duration]),
    [
      [5, 10],
      [0, 5],
    ],
  );
  await drop(2);
  assert.equal(project.layers.filter((e) => e.trackId === track.id).length, 2);
  await click('header button[aria-label="Undo"]');
  await save();
  assert.equal(project.layers.filter((e) => e.trackId === track.id).length, 1);
  await click('header button[aria-label="Redo"]');
  await save();
  assert.equal(project.layers.filter((e) => e.trackId === track.id).length, 2);
  await click(`button[aria-label="Settings for Montage"]`);
  await fill("dialog[open] input", "Pictures");
  await click('dialog[open] button[type="submit"]');
  await save();
  assert.equal(project.tracks.find((t) => t.id === track.id).name, "Pictures");
  assert.equal(
    project.layers.find((e) => e.id === first.id).name,
    "Sample image",
  );
  // Move a real element to an empty layer using pointer events, then undo.
  await click('button[aria-label="New layer"]');
  await fill("dialog[open] input", "Destination");
  await click('dialog[open] button[type="submit"]');
  await save();
  const target = project.tracks.find((t) => t.name === "Destination");
  await page.evaluate(() =>
    [...document.querySelectorAll(".timeline-tools button")]
      .find((e) => e.textContent.trim() === "Text")
      .click(),
  );
  await save();
  assert.equal(project.layers.at(-1).trackId, target.id);
  assert.equal(project.layers.at(-1).type, "title");
  await click('header button[aria-label="Undo"]');
  await save();

  const points = await page.evaluate(
    (id, to) => {
      const c = document.querySelector(`[data-element-id="${id}"]`);
      c.scrollIntoView({ block: "nearest" });
      const a = c.getBoundingClientRect(),
        b = document
          .querySelector(`[data-track-id="${to}"] .track-lane`)
          .getBoundingClientRect();
      return {
        x: a.left + Math.min(30, a.width / 2),
        y: a.top + 15,
        toY: b.top + 20,
      };
    },
    first.id,
    target.id,
  );
  const client = page._client();
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: points.x,
    y: points.y,
    button: "left",
    clickCount: 1,
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: points.x,
    y: points.toY,
    button: "left",
    buttons: 1,
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: points.x,
    y: points.toY,
    button: "left",
    clickCount: 1,
  });
  await save();
  assert.equal(
    project.layers.find((e) => e.id === first.id).trackId,
    target.id,
  );
  await click('header button[aria-label="Undo"]');
  await save();
  assert.equal(project.layers.find((e) => e.id === first.id).trackId, track.id);
  await click('button[aria-label="Settings for Pictures"]');
  await page.evaluate(() =>
    [...document.querySelectorAll("dialog[open] button")]
      .find((e) => e.textContent === "Delete layer")
      .click(),
  );
  await save();
  assert.ok(!project.tracks.some((t) => t.id === track.id));
  assert.ok(!project.layers.some((e) => e.trackId === track.id));
  await click('header button[aria-label="Undo"]');
  await save();
  assert.equal(project.layers.filter((e) => e.trackId === track.id).length, 2);
  // Backspace deletes the current multi-selection, keeps layers, and is one Undo step.
  const beforeBackspace = structuredClone(project);
  const selectedElements = project.layers
    .filter((e) => e.trackId === track.id)
    .map((e) => e.id);
  // Selection handlers update between events, just as separate user clicks do.
  await page.evaluate(
    (id) =>
      document
        .querySelector(`[data-element-id="${id}"]`)
        .dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        ),
    selectedElements[0],
  );
  await page.evaluate(
    (id) =>
      document.querySelector(`[data-element-id="${id}"]`).dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          shiftKey: true,
          bubbles: true,
        }),
      ),
    selectedElements[1],
  );
  await page.evaluate(() => {
    const input = document.querySelector(".inspector input");
    input.focus();
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Backspace",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await save();
  assert.deepEqual(project, beforeBackspace);
  await page.evaluate(() => {
    document.activeElement.blur();
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Backspace",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await save();
  assert.ok(
    selectedElements.every((id) => !project.layers.some((e) => e.id === id)),
  );
  assert.deepEqual(project.tracks, beforeBackspace.tracks);
  await click('header button[aria-label="Undo"]');
  await save();
  assert.deepEqual(project, beforeBackspace);
  // A rejected Inspector timing edit restores the displayed saved value.
  await page.evaluate(
    (id) =>
      document
        .querySelector(`[data-element-id="${id}"]`)
        .dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        ),
    first.id,
  );
  await page.evaluate(() =>
    document.querySelector('.inspector input[type="number"]').focus(),
  );
  await fill('.inspector input[type="number"]', "2");
  await page.evaluate(() =>
    document.querySelector('.inspector input[type="number"]').blur(),
  );
  assert.equal(
    await page.evaluate(
      () => document.querySelector('.inspector input[type="number"]').value,
    ),
    "5",
  );
  assert.equal(project.layers.find((e) => e.id === first.id).start, 5);
  // Effects remain attached to the target element, never to every element on its layer.
  await page.evaluate((id) => {
    const transfer = new DataTransfer();
    transfer.setData("application/x-kamikami-effect", "slow-push");
    document.querySelector(`[data-element-id="${id}"]`).dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }),
    );
  }, first.id);
  await save();
  assert.equal(project.layers.find((e) => e.id === first.id).effects.length, 1);
  assert.equal(
    project.layers.find((e) => e.trackId === track.id && e.id !== first.id)
      .effects.length,
    0,
  );
  assert.ok((await text()).includes("SELECTED ELEMENT"));
  await click('header button[aria-label="Undo"]');
  await save();
  await page.evaluate(() =>
    [...document.querySelectorAll(".library .tabs button, aside .tabs button")]
      .find((e) => e.textContent.trim() === "Effects")
      .click(),
  );
  await page.evaluate(() =>
    document
      .querySelector(".effect-card")
      .dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
  );
  await wait(() => exists("dialog[open] .effect-editor"));
  await click('button[aria-label="Close effect controls"]');
  await wait(async () => !(await exists("dialog[open]")));
  assert.equal(await exists(".inspector .effect-editor"), false);
  const beforeShortening = structuredClone(project);
  await click(".project-name");
  await fill('dialog[open] input[type="number"]', "2");
  await click('dialog[open] button[type="submit"]');
  assert.ok(await exists("dialog[open]"));
  assert.equal(project.duration, 15);
  await click('dialog[open] input[type="checkbox"]');
  await click('dialog[open] button[type="submit"]');
  await save();
  assert.equal(project.duration, 2);
  await click('header button[aria-label="Undo"]');
  await save();
  assert.deepEqual(project, beforeShortening);
  await page.evaluate(
    () => (document.querySelector(".timeline-scroll").scrollTop = 0),
  );
  const shot = await client.send("Page.captureScreenshot", { format: "png" });
  await writeFile(
    path.join(output, "editor.png"),
    Buffer.from(shot.value.data, "base64"),
  );
  await click(".project-name");
  const modal = await client.send("Page.captureScreenshot", { format: "png" });
  await writeFile(
    path.join(output, "project-settings.png"),
    Buffer.from(modal.value.data, "base64"),
  );
  await click('dialog[open] button[type="button"]');
  await page.setViewport({ width: 1120, height: 780, deviceScaleFactor: 1 });
  await page.evaluate(
    (id) =>
      document
        .querySelector(`[data-element-id="${id}"]`)
        .dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        ),
    first.id,
  );
  const compact = await client.send("Page.captureScreenshot", {
    format: "png",
  });
  await writeFile(
    path.join(output, "compact.png"),
    Buffer.from(compact.value.data, "base64"),
  );
  const saved = structuredClone(project);
  await page.goto({ url: "http://127.0.0.1:5174", timeout: 30000 });
  await wait(() => exists(".media-card"));
  assert.deepEqual(project, saved);
  assert.equal(
    await page.evaluate(
      () => document.querySelectorAll("[data-track-id]").length,
    ),
    saved.tracks.length,
  );
  assert.equal(
    await page.evaluate(
      () => document.querySelectorAll("[data-element-id]").length,
    ),
    saved.layers.length,
  );
  assert.deepEqual(errors, []);
  console.log(`Browser checks passed. Screenshots: ${output}`);
} finally {
  await browser?.close({ silent: true });
  await server.close();
  await rm(fontData, { recursive: true, force: true });
}
