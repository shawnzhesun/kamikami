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
          effectEngine: "kamikami-visual-v8",
          projectVersion: 3,
          effectLibraryVersion: 2,
          elementTypes: [
            "scene",
            "title",
            "image",
            "video",
            "audio",
            "shape",
            "backdrop",
          ],
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
        result = await effectLibrary.importFile(JSON.parse(body));
      else if (req.url === "/api/effects/remove-pack")
        result = await effectLibrary.removePack(JSON.parse(body).packId);
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
      forget: async () => {
        localStorage.removeItem("fixture-project-file");
        window.fixtureForgot = true;
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
  };
  await wait(() => exists(".media-card"));
  assert.deepEqual(
    await page.evaluate(() =>
      [...document.querySelectorAll(".header-start > *")].map((e) =>
        e.classList.contains("brand")
          ? "brand"
          : [...e.querySelectorAll("button")].map((b) =>
              b.getAttribute("aria-label"),
            ),
      ),
    ),
    ["brand", ["New project", "Open project"]],
    "New and Open sit right of the logo",
  );
  for (const width of [1100, 1440]) {
    await page.setViewport({ width, height: 980, deviceScaleFactor: 1 });
    const layout = await page.evaluate(() => {
      const header = document.querySelector("header").getBoundingClientRect();
      const title = document
        .querySelector(".project-name")
        .getBoundingClientRect();
      const actions = document
        .querySelector(".header-actions")
        .getBoundingClientRect();
      const start = document
        .querySelector(".header-file-actions")
        .getBoundingClientRect();
      const fits = [...document.querySelectorAll("header button")].every(
        (b) => b.scrollWidth <= b.clientWidth + 1,
      );
      return {
        centered:
          Math.abs(title.x + title.width / 2 - header.x - header.width / 2) < 1,
        separated: title.right <= actions.left && start.right <= title.left,
        fits,
      };
    });
    assert.ok(layout.centered, `Project title is centered at ${width}px`);
    assert.ok(layout.fits, `Header buttons are not clipped at ${width}px`);
    assert.ok(
      layout.separated,
      `Header actions do not overlap the title at ${width}px`,
    );
  }
  assert.equal(await exists(".library .library-foot"), false);
  assert.ok(!(await text()).includes("Download project JSON"));
  assert.ok((await text()).includes("Add media"));
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
  // The move handle drags the selected element even where others cover it.
  const titleX = project.layers.find((e) => e.id === "title").x;
  const handle = await page.evaluate(() => {
    const r = document
      .querySelector(".canvas-selection .canvas-move")
      .getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  for (const [type, dx] of [
    ["mousePressed", 0],
    ["mouseMoved", 20],
    ["mouseMoved", 40],
    ["mouseReleased", 40],
  ])
    await page._client().send("Input.dispatchMouseEvent", {
      type,
      x: handle.x + dx,
      y: handle.y,
      button: "left",
      buttons: type === "mouseReleased" ? 0 : 1,
      clickCount: 1,
    });
  await save();
  assert.ok(project.layers.find((e) => e.id === "title").x > titleX + 10);
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
  // Analysis is on demand: the card's status sits left of Details and opens
  // the analysis dialog for that asset.
  assert.deepEqual(
    await page.evaluate(() =>
      [...document.querySelectorAll(".media-card-actions > button")]
        .filter((b) => !b.classList.contains("media-delete"))
        .map((b) => b.textContent.trim()),
    ),
    ["Not analyzed", "Details"],
  );
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((e) => e.textContent.trim() === "Media")
      .click(),
  );
  await writeFile(
    path.join(output, "media.png"),
    Buffer.from(
      (await page._client().send("Page.captureScreenshot", { format: "png" }))
        .value.data,
      "base64",
    ),
  );
  await click(".media-card-actions .analysis-badge");
  await wait(() =>
    page.evaluate(
      () =>
        document.querySelector("dialog[open] h2")?.textContent ===
        "Analyze \u201cSample image\u201d",
    ),
  );
  await page.evaluate(() =>
    [...document.querySelectorAll("dialog[open] button")]
      .find((e) => e.textContent === "Cancel")
      .click(),
  );
  await wait(async () => !(await exists("dialog[open]")));
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
  // The timeline ignores clicks for 200 ms after a drag ends.
  await new Promise((resolve) => setTimeout(resolve, 250));
  await click('button[aria-label="Settings for Pictures"]');
  await wait(() => exists("dialog[open] .delete-layer-action"));
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
  // Dragging over empty lane space selects every clip the box touches.
  const pair = project.layers
    .filter((e) => e.trackId === track.id)
    .sort((a, b) => a.start - b.start);
  // The clips fill their lane, so the box starts in another layer's free space.
  const box = await page.evaluate((id) => {
    const target = document.querySelector(
      `[data-track-id="${id}"] .track-lane`,
    );
    target.scrollIntoView({ block: "nearest" });
    const t = target.getBoundingClientRect();
    for (const lane of document.querySelectorAll(".track-lane")) {
      const r = lane.getBoundingClientRect(),
        y = r.top + 20;
      if (lane === target || y < 0 || y > innerHeight) continue;
      for (let x = r.right - 3; x > r.left; x -= 4)
        if (document.elementFromPoint(x, y) === lane)
          return { x, y, toX: t.left + 1, toY: t.top + 20 };
    }
    throw new Error("No empty lane space");
  }, track.id);
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: box.x,
    y: box.y,
    button: "left",
    clickCount: 1,
  });
  for (const [x, y] of [
    [box.x - 20, box.y + 4],
    [box.toX, box.toY],
  ])
    await client.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x,
      y,
      button: "left",
      buttons: 1,
    });
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: box.toX,
    y: box.toY,
    button: "left",
    clickCount: 1,
  });
  await wait(async () => !(await exists(".timeline-marquee")));
  const pressed = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-element-id][aria-pressed="true"]')]
        .map((e) => e.dataset.elementId)
        .sort(),
    );
  const boxed = await pressed();
  assert.ok(pair.every((e) => boxed.includes(e.id)));
  // A plain click narrows the selection; Shift-drag adds a clip and moves both.
  await new Promise((resolve) => setTimeout(resolve, 250));
  const clipPoint = (id) =>
    page.evaluate((id) => {
      const r = document
        .querySelector(`[data-element-id="${id}"]`)
        .getBoundingClientRect();
      return {
        x: r.left + Math.min(30, r.width / 2),
        y: r.top + 15,
      };
    }, id);
  const press = async (id, modifiers = 0, dx = 0) => {
    const p = await clipPoint(id);
    const step = dx;
    for (const [type, x] of [
      ["mousePressed", p.x],
      ["mouseMoved", p.x + step / 2],
      ["mouseMoved", p.x + step],
      ["mouseReleased", p.x + step],
    ])
      await client.send("Input.dispatchMouseEvent", {
        type,
        x,
        y: p.y,
        modifiers,
        button: "left",
        buttons: type === "mouseReleased" ? 0 : 1,
        clickCount: 1,
      });
  };
  // Trim a second off the later clip, so the pair has room to move right.
  await page.evaluate(
    (id) =>
      document
        .querySelector(`[data-element-id="${id}"] .trim-handle.right`)
        .dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "ArrowLeft",
            shiftKey: true,
            bubbles: true,
          }),
        ),
    pair[1].id,
  );
  await press(pair[0].id);
  await wait(async () => (await pressed()).length === 1);
  await new Promise((resolve) => setTimeout(resolve, 250));
  await press(pair[1].id, 8, 40);
  await save();
  const moved = pair.map(
    (e) => project.layers.find((l) => l.id === e.id).start - e.start,
  );
  assert.ok(Math.abs(moved[0]) > 0.01, "Shift-drag moved the clips");
  assert.ok(Math.abs(moved[0] - moved[1]) < 1e-6, "Both clips moved together");
  await click('header button[aria-label="Undo"]');
  await click('header button[aria-label="Undo"]');
  await save();
  assert.deepEqual(
    pair.map((e) => project.layers.find((l) => l.id === e.id)),
    pair,
  );
  // Cmd-scroll zooms the timeline around the pointer, up to frame-level detail.
  const zoomed = await page.evaluate(async () => {
    const panel = document.querySelector(".timeline-scroll"),
      r = panel.getBoundingClientRect(),
      x = r.left + r.width * 0.6;
    const width = panel.scrollWidth;
    panel.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: -200,
        clientX: x,
        clientY: r.top + 60,
        metaKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return {
      grew: panel.scrollWidth / width,
      max: Number(
        document.querySelector('input[aria-label="Timeline zoom"]').max,
      ),
      label: [...document.querySelectorAll(".timeline-tools button")].find(
        (b) => b.title.startsWith("Fit timeline"),
      ).textContent,
    };
  });
  assert.ok(zoomed.grew > 2, `Zoom grew the timeline ${zoomed.grew}×`);
  assert.ok(zoomed.max >= 3);
  assert.notEqual(zoomed.label, "1×");
  await page.evaluate(() =>
    [...document.querySelectorAll(".timeline-tools button")]
      .find((b) => b.title.startsWith("Fit timeline"))
      .click(),
  );
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
  assert.equal(await exists("dialog[open]"), false);
  assert.equal(await exists(".inspector .effect-editor"), false);
  await click('.inspector .instance button[title="Edit effect settings"]');
  await wait(() => exists("dialog[open] .effect-editor"));
  assert.equal(await exists(".inspector .effect-editor"), false);
  assert.equal(
    await exists(
      '.effect-dialog-header button[aria-label="Close effect settings"]',
    ),
    true,
  );
  const beforeEffectEdit = structuredClone(project);
  assert.equal(await exists('input[aria-label="Effect name"]'), false);
  assert.equal(await exists('button[aria-label="Fork effect"]'), false);
  assert.equal(
    await exists('button[aria-label="Delete from My effects"]'),
    false,
  );
  const originalFrom = project.layers
    .find((layer) => layer.id === first.id)
    .effects.find((effect) => effect.effectId === "slow-push").settings
    .channels[0].from;
  await fill('.effect-dialog-body input[type="number"]', "1.02");
  await click('button[aria-label="Close effect settings"]');
  await wait(async () => !(await exists("dialog[open]")));
  await save();
  assert.deepEqual(project, beforeEffectEdit);
  await click('.inspector .instance button[title="Edit effect settings"]');
  await wait(() => exists("dialog[open] .effect-editor"));
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector('.effect-dialog-body input[type="number"]')
          .value,
    ),
    String(originalFrom),
  );
  await fill('.effect-dialog-body input[type="number"]', "1.02");
  // Number fields commit on blur, which a real click on Save causes first.
  await page.evaluate(() =>
    document
      .querySelector('.effect-dialog-body input[type="number"]')
      .dispatchEvent(new FocusEvent("focusout", { bubbles: true })),
  );
  await click('.effect-dialog-footer button[type="submit"]');
  await wait(async () => !(await exists("dialog[open]")));
  await save();
  assert.equal(
    project.layers
      .find((layer) => layer.id === first.id)
      .effects.find((effect) => effect.effectId === "slow-push").settings
      .channels[0].from,
    1.02,
  );
  assert.deepEqual(project.effects, beforeEffectEdit.effects);
  await click('header button[aria-label="Undo"]');
  await save();
  assert.deepEqual(project, beforeEffectEdit);
  await click('.inspector .instance button[title="Edit effect settings"]');
  await wait(() => exists("dialog[open] .effect-editor"));
  await fill('.effect-dialog-body input[type="number"]', "1.03");
  await page.evaluate(() =>
    document
      .querySelector("dialog[open]")
      .dispatchEvent(new Event("cancel", { cancelable: true })),
  );
  await wait(async () => !(await exists("dialog[open]")));
  await save();
  assert.deepEqual(project, beforeEffectEdit);
  await wait(async () => !(await exists("dialog[open]")));
  assert.equal(
    await page.evaluate(
      (id) =>
        document
          .querySelector(`[data-element-id="${id}"]`)
          .getAttribute("aria-pressed"),
      first.id,
    ),
    "true",
  );
  await click('header button[aria-label="Undo"]');
  await save();
  await page.evaluate(() =>
    [...document.querySelectorAll(".library .tabs button, aside .tabs button")]
      .find((e) => e.textContent.trim() === "Effects")
      .click(),
  );
  await page.evaluate(() =>
    document
      .querySelector('.effect-card[aria-label^="Color flash."]')
      .dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
  );
  await wait(() => exists("dialog[open] .effect-editor"));
  assert.equal(await exists(".effect-dialog-body input"), false);
  assert.equal(await exists('button[aria-label="Fork effect"]'), true);
  assert.equal(
    await exists('.effect-dialog-footer button[type="submit"]'),
    false,
  );
  assert.equal(
    await page.evaluate(() =>
      [...document.querySelectorAll("dialog[open] button")].some((button) =>
        /Delete|Export effect/.test(button.textContent),
      ),
    ),
    false,
  );
  const beforeFork = structuredClone(project);
  // Fork stays disabled while an effect-library save is in flight.
  await wait(() => exists('button[aria-label="Fork effect"]:not(:disabled)'));
  await click('button[aria-label="Fork effect"]');
  await wait(() => exists('input[aria-label="Effect name"]'));
  assert.equal(
    await exists('button[aria-label="Delete from My effects"]'),
    true,
  );
  await fill('input[aria-label="Effect name"]', "My red flash");
  await click('button[aria-label="Color flash presets"]');
  await wait(() => exists(".effect-preset-option"));
  await page.evaluate(() =>
    [...document.querySelectorAll(".effect-preset-option")]
      .find((button) => button.textContent.trim() === "Red")
      .click(),
  );
  await click('.effect-dialog-footer button[type="submit"]');
  await wait(async () => !(await exists("dialog[open]")));
  await save();
  const fork = project.effects.find((effect) => effect.name === "My red flash");
  assert.ok(fork);
  assert.notEqual(fork.id, "color-flash");
  assert.equal(fork.passes[0].color, "#fa162a");
  assert.deepEqual(
    project.effects.filter((effect) => effect.id !== fork.id),
    beforeFork.effects,
  );
  await wait(() => exists('.effect-card[aria-label^="My red flash."]'));
  await page.evaluate(() =>
    document
      .querySelector('.effect-card[aria-label^="My red flash."]')
      .dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
  );
  await wait(() => exists('button[aria-label="Delete from My effects"]'));
  await click('button[aria-label="Delete from My effects"]');
  await wait(async () => !(await exists("dialog[open]")));
  assert.equal(
    await exists('.effect-card[aria-label^="My red flash."]'),
    false,
  );
  assert.equal(await exists(".inspector .effect-editor"), false);
  // Native typography recipes apply to text and expose editable controls in the modal.
  const beforeTypography = structuredClone(project);
  await page.evaluate(() =>
    document
      .querySelector('[data-element-id="title"]')
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
  );
  await page.evaluate(() =>
    document
      .querySelector('.effect-card[aria-label^="Typewriter."]')
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
  );
  await save();
  assert.equal(
    project.effects.find((effect) => effect.id === "text-typewriter").text.kind,
    "typewriter",
  );
  assert.ok(
    project.layers
      .find((layer) => layer.id === "title")
      .effects.some((effect) => effect.effectId === "text-typewriter"),
  );
  const typographyPresets = structuredClone(project.effects);
  await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        '.inspector .instance button[title="Edit effect settings"]',
      ),
    ]
      .find((button) => button.textContent.includes("Typewriter"))
      .click(),
  );
  await wait(() =>
    exists('dialog[open] button[aria-label="Text animation unit"]'),
  );
  await fill('.effect-dialog-body input[type="number"]', "2.5");
  await page.evaluate(() =>
    document
      .querySelector('.effect-dialog-body input[type="number"]')
      .dispatchEvent(new FocusEvent("focusout", { bubbles: true })),
  );
  await click('.effect-dialog-footer button[type="submit"]');
  await wait(async () => !(await exists("dialog[open]")));
  await save();
  assert.equal(
    project.layers
      .find((layer) => layer.id === "title")
      .effects.find((effect) => effect.effectId === "text-typewriter").settings
      .text.seconds,
    2.5,
  );
  assert.deepEqual(project.effects, typographyPresets);
  await click('header button[aria-label="Undo"]');
  await click('header button[aria-label="Undo"]');
  await save();
  assert.deepEqual(project, beforeTypography);
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
  // New project asks before replacing edits, detaches the file and is undoable.
  const newProjectButton = 'header button[aria-label="New project"]';
  await page.setViewport({ width: 1440, height: 980, deviceScaleFactor: 1 });
  const header = await client.send("Page.captureScreenshot", {
    format: "png",
    clip: { x: 0, y: 0, width: 1440, height: 70, scale: 1 },
  });
  await writeFile(
    path.join(output, "header.png"),
    Buffer.from(header.value.data, "base64"),
  );
  await click(newProjectButton);
  await wait(() => exists("dialog.new-project-dialog[open]"));
  const prompt = await client.send("Page.captureScreenshot", {
    format: "png",
  });
  await writeFile(
    path.join(output, "new-project.png"),
    Buffer.from(prompt.value.data, "base64"),
  );
  assert.match(
    await page.evaluate(
      () => document.querySelector("dialog.new-project-dialog").textContent,
    ),
    /may not be in fixture\.json/,
  );
  await page.evaluate(() =>
    [...document.querySelectorAll("dialog[open] button")]
      .find((e) => e.textContent === "Cancel")
      .click(),
  );
  await wait(async () => !(await exists("dialog[open]")));
  assert.deepEqual(project, saved);
  await click(newProjectButton);
  await wait(() => exists("dialog.new-project-dialog[open]"));
  await page.evaluate(() =>
    [...document.querySelectorAll("dialog[open] button")]
      .find((e) => e.textContent === "Don’t save")
      .click(),
  );
  // Then the new project's name and format, which can't change later.
  await wait(() => exists('dialog[aria-label="New project"][open]'));
  assert.match(
    await page.evaluate(
      () =>
        document.querySelector('dialog[aria-label="New project"]').textContent,
    ),
    /can’t be changed after the project is created/,
  );
  await page.evaluate(() =>
    [...document.querySelectorAll("dialog[open] button")]
      .find((e) => e.textContent === "Create project")
      .click(),
  );
  await wait(() => project.layers.length === 0);
  assert.equal(project.name, "Untitled project");
  assert.equal(project.width, saved.width);
  assert.equal(project.fps, saved.fps);
  assert.equal(project.tracks.length, 1);
  assert.equal(await page.evaluate(() => window.fixtureForgot), true);
  await wait(() =>
    exists('header button[title="Save project JSON… (⌘/Ctrl S)"]'),
  );
  assert.equal(
    await page.evaluate(
      () => document.querySelector(".project-name").textContent,
    ),
    "Untitled project",
  );
  // A fresh, unedited project skips the save prompt and goes straight to setup.
  await click(newProjectButton);
  await wait(() => exists('dialog[aria-label="New project"][open]'));
  assert.equal(await exists("dialog.new-project-dialog[open]"), false);
  await page.evaluate(() =>
    [...document.querySelectorAll("dialog[open] button")]
      .find((e) => e.textContent === "Cancel")
      .click(),
  );
  await wait(async () => !(await exists("dialog[open]")));
  await click('header button[aria-label="Undo"]');
  await wait(() => project.layers.length === saved.layers.length);
  assert.equal(project.name, saved.name);
  // Backdrops land on their own full-length layers.
  await click(
    'button[title="Add a full-frame background or finishing overlay"]',
  );
  await wait(() => exists('button[aria-label="Add rings"]'));
  await click('button[aria-label="Add rings"]');
  await save();
  // Save may finish choosing a file before the recovery copy lands.
  await wait(() => project.layers.some((l) => l.type === "backdrop"));
  const rings = project.layers.find((l) => l.type === "backdrop");
  assert.equal(rings.backdrop.kind, "rings");
  assert.equal(
    project.tracks[0].id,
    rings.trackId,
    "backgrounds go under everything",
  );
  assert.ok((await text()).includes("BACKDROP"));
  await click('header button[aria-label="Undo"]');
  await save();
  await wait(() => !project.layers.some((l) => l.type === "backdrop"));
  // Effects by role: apply an entrance, retime its In phase on the clip,
  // and see picture-only cards dim while text is selected.
  const titleId = project.layers.find((l) => l.type === "title").id;
  await page.evaluate((id) => {
    [...document.querySelectorAll("button")]
      .find((e) => e.textContent.trim() === "Effects")
      .click();
    document
      .querySelector(`[data-element-id="${id}"]`)
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
  }, titleId);
  await wait(() => exists('.effect-roles [role="tab"]'));
  await page.evaluate(() =>
    [...document.querySelectorAll('.effect-roles [role="tab"]')]
      .find((e) => e.textContent === "Out")
      .click(),
  );
  await wait(() => exists('.effect-section[aria-label="Break"]'));
  assert.ok(await exists('.effect-section[aria-label="Conceal"]'));
  assert.equal(await exists('.effect-section[aria-label="Arrive"]'), false);
  await page.evaluate(() =>
    [...document.querySelectorAll('.effect-roles [role="tab"]')]
      .find((e) => e.textContent === "All")
      .click(),
  );
  await fill('input[aria-label="Search effects"]', "Color ghost trail");
  await wait(() => exists(".effect-card.effect-mismatch"));
  await fill('input[aria-label="Search effects"]', "Spring in");
  await wait(() => exists('.effect-card[aria-label^="Spring in."]'));
  await page.evaluate(() =>
    document
      .querySelector('.effect-card[aria-label^="Spring in."]')
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
  );
  await save();
  await wait(() => exists(`[data-element-id="${titleId}"] .phase-handle.in`));
  const springSeconds = () =>
    project.layers
      .find((l) => l.id === titleId)
      .effects.find((i) => i.effectId === "kinetic-spring")?.settings?.text
      ?.seconds;
  await wait(() => springSeconds() === 1.1);
  await page.evaluate(
    (id) =>
      document
        .querySelector(`[data-element-id="${id}"] .phase-handle.in`)
        .dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "ArrowRight",
            shiftKey: true,
            bubbles: true,
          }),
        ),
    titleId,
  );
  await save();
  await wait(() => Math.abs(springSeconds() - 1.2) < 1e-6);
  const phases = await client.send("Page.captureScreenshot", {
    format: "png",
  });
  await writeFile(
    path.join(output, "roles.png"),
    Buffer.from(phases.value.data, "base64"),
  );
  await click('header button[aria-label="Undo"]');
  await click('header button[aria-label="Undo"]');
  await save();
  await wait(() => springSeconds() === undefined);
  // Overlays: feel sections, then a balloon's shape and shared style settings.
  await fill('input[aria-label="Search effects"]', "");
  await page.evaluate(() =>
    [...document.querySelectorAll('.effect-roles [role="tab"]')]
      .find((e) => e.textContent === "Overlay")
      .click(),
  );
  for (const feel of ["Annotate", "Emotion", "Comic", "Interface", "Connect"])
    await wait(() => exists(`.effect-section[aria-label="${feel}"]`));
  const gallery = await client.send("Page.captureScreenshot", {
    format: "png",
  });
  await writeFile(
    path.join(output, "overlays.png"),
    Buffer.from(gallery.value.data, "base64"),
  );
  await fill('input[aria-label="Search effects"]', "Speech balloon");
  await wait(() => exists('.effect-card[aria-label^="Speech balloon."]'));
  await page.evaluate(() =>
    document
      .querySelector('.effect-card[aria-label^="Speech balloon."]')
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
  );
  await save();
  await wait(() =>
    project.layers
      .find((l) => l.id === titleId)
      .effects.some((i) => i.effectId === "overlay-balloon"),
  );
  await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        '.inspector .instance button[title="Edit effect settings"]',
      ),
    ]
      .at(-1)
      .click(),
  );
  await wait(() => exists('[aria-label="Overlay line style"]'));
  assert.ok(await exists('[aria-label="Overlay shape"]'));
  assert.ok(await exists('[aria-label="Overlay entrance"]'));
  const settings = await client.send("Page.captureScreenshot", {
    format: "png",
  });
  await writeFile(
    path.join(output, "overlay-settings.png"),
    Buffer.from(settings.value.data, "base64"),
  );
  // Effect packs: import a pack file, find it as its own collection, export
  // it again, then remove it.
  await click('button[aria-label="Close effect settings"]');
  await wait(async () => !(await exists("dialog[open]")));
  const packFile = {
    format: "kamikami-effect-pack",
    version: 1,
    engine: "frameforge-curves-v1",
    id: "ui-pack",
    name: "UI Pack",
    author: "QA",
    description: "Two test effects",
    effects: ["One", "Two"].map((name) => ({
      effect: { ...initialProject.effects[0], id: name.toLowerCase(), name },
    })),
  };
  await page.evaluate(
    (files) => {
      const input = [...document.querySelectorAll('input[type="file"]')].find(
        (e) => e.accept === "application/json,.json",
      );
      const transfer = new DataTransfer();
      for (const [name, body] of files)
        transfer.items.add(new File([body], name));
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    [
      ["ui-pack.kamikami-effects.json", JSON.stringify(packFile)],
      ["broken.json", "{"],
    ],
  );
  await wait(() => exists('.pack-header[aria-label="UI Pack pack"]'));
  assert.ok((await text()).includes("Imported UI Pack (2 effects)"));
  assert.ok((await text()).includes("Couldn't import broken.json"));
  assert.equal(
    await page.evaluate(
      () => document.querySelectorAll(".effects-grid .effect-card").length >= 2,
    ),
    true,
  );
  await page.evaluate(() => {
    window.downloads = [];
    HTMLAnchorElement.prototype.click = function () {
      window.downloads.push(
        fetch(this.href)
          .then((r) => r.text())
          .then((body) => ({ name: this.download, body })),
      );
    };
  });
  await page.evaluate(() =>
    [...document.querySelectorAll(".pack-header button")]
      .find((b) => b.textContent.trim() === "Export")
      .click(),
  );
  await wait(() => exists("dialog[open] .export-effects"));
  assert.equal(
    await page.evaluate(
      () => document.querySelector("dialog[open] .primary").textContent,
    ),
    "Export 2 effects",
  );
  const capture = async (name) =>
    writeFile(
      path.join(output, name),
      Buffer.from(
        (await client.send("Page.captureScreenshot", { format: "png" })).value
          .data,
        "base64",
      ),
    );
  await capture("export-effects.png");
  await click("dialog[open] .primary");
  await wait(async () => !(await exists("dialog[open]")));
  await capture("effect-pack.png");
  const [download] = await page.evaluate(() => Promise.all(window.downloads));
  assert.equal(download.name, "ui-pack.kamikami-effects.json");
  const exportedPack = JSON.parse(download.body);
  assert.equal(exportedPack.id, "ui-pack");
  assert.deepEqual(
    exportedPack.effects.map((e) => e.effect.name),
    ["One", "Two"],
  );
  await page.evaluate(() =>
    [...document.querySelectorAll(".pack-header button")]
      .find((b) => b.textContent.trim() === "Remove pack")
      .click(),
  );
  await wait(() => exists("dialog[open]"));
  await click("dialog[open] .primary");
  await wait(() => text().then((t) => t.includes("Removed UI Pack")));
  assert.equal(await exists(".pack-header"), false);
  assert.equal((await effectLibrary.list()).filter((e) => e.pack).length, 0);
  assert.deepEqual(errors, []);
  console.log(`Browser checks passed. Screenshots: ${output}`);
} finally {
  await browser?.close({ silent: true });
  await server.close();
  await rm(fontData, { recursive: true, force: true });
}
