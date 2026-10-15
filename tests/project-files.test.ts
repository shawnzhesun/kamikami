import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import {
  mkdtemp,
  readFile,
  writeFile,
  readdir,
  unlink,
  rm,
  mkdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { blankProject, initialProject, validateProject } from "../src/model";
import {
  ProjectFileAccess,
  projectJson,
  type ProjectFileHandle,
} from "../src/project-files";
const { ProjectFiles } = createRequire(import.meta.url)(
  "../electron/project-files.cjs",
);

test("desktop startup registers project IPC before loading the editor and Save reaches the file writer", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "kamikami-project-ipc-"));
  try {
    const handlers = new Map<string, (...args: any[]) => Promise<any>>();
    const filename = path.join(dir, "movie.json");
    let startup: Promise<unknown> | undefined;
    let loaded = false;
    let dialogs = 0;
    const assertHandlers = () => {
      for (const name of ["info", "open", "accept", "save", "forget"])
        assert.ok(
          handlers.has(`project-file:${name}`),
          `Missing ${name} handler`,
        );
    };
    class Window {
      static fromWebContents() {
        return {};
      }
      webContents = { setWindowOpenHandler() {}, on() {} };
      loadURL() {
        assertHandlers();
        loaded = true;
      }
    }
    const electron = {
      app: {
        getPath: () => dir,
        setPath() {},
        setName() {},
        on() {},
        isPackaged: false,
        requestSingleInstanceLock: () => true,
        dock: { setIcon() {} },
        whenReady: () => ({
          then: (callback: () => unknown) => {
            startup = Promise.resolve().then(callback);
            return startup;
          },
        }),
      },
      ipcMain: {
        handle: (name: string, callback: (...args: any[]) => Promise<any>) => {
          assert.ok(!handlers.has(name));
          handlers.set(name, callback);
        },
      },
      dialog: {
        showSaveDialog: async () => {
          dialogs++;
          return { canceled: false, filePath: filename };
        },
      },
      BrowserWindow: Window,
      nativeImage: { createFromPath() {} },
      session: { defaultSession: { setPermissionRequestHandler() {} } },
    };
    const nativeRequire = createRequire(import.meta.url);
    const electronDir = path.resolve("electron");
    // Shared origins, evaluated against the mocked app (development mode).
    const runtimeModule = { exports: {} };
    runInNewContext(
      await readFile(path.join(electronDir, "runtime.cjs"), "utf8"),
      {
        module: runtimeModule,
        __dirname: electronDir,
        process,
        require: (name: string) =>
          name === "electron" ? electron : nativeRequire(name),
      },
    );
    const projectModule = { exports: {} as { installProjectFiles(): void } };
    runInNewContext(
      await readFile(path.join(electronDir, "project-files.cjs"), "utf8"),
      {
        module: projectModule,
        __dirname: electronDir,
        Buffer,
        URL,
        require: (name: string) => {
          if (name === "electron") return electron;
          if (name === "./runtime.cjs") return runtimeModule.exports;
          return nativeRequire(name);
        },
      },
    );
    runInNewContext(
      await readFile(path.join(electronDir, "main.cjs"), "utf8"),
      {
        __dirname: electronDir,
        process,
        URL,
        require: (name: string) => {
          if (name === "electron") return electron;
          if (name === "./project-files.cjs") return projectModule.exports;
          if (name === "./runtime.cjs") return runtimeModule.exports;
          if (name === "./assistant-credentials.cjs")
            return async () => assertHandlers();
          return nativeRequire(name);
        },
      },
    );
    await startup;
    assert.equal(loaded, true);
    const frame = { url: "http://127.0.0.1:5173/" };
    const event = { senderFrame: frame, sender: { mainFrame: frame } };
    const save = handlers.get("project-file:save")!;
    await save(event, projectJson(initialProject), initialProject.name);
    await save(
      event,
      projectJson({ ...initialProject, name: "Updated" }),
      "Updated",
    );
    assert.equal(dialogs, 1);
    assert.equal(JSON.parse(await readFile(filename, "utf8")).name, "Updated");
    const info = await handlers.get("project-file:info")!(event);
    assert.equal(info.file.name, "movie.json");
    const untrusted = { url: "https://example.com/" };
    await assert.rejects(
      save(
        { senderFrame: untrusted, sender: { mainFrame: untrusted } },
        projectJson(initialProject),
        "Movie",
      ),
      /Only the editor/,
    );
    assert.equal(dialogs, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("stale desktop handlers report restart instructions instead of promising a file picker", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  const missing = (channel: string) => async () => {
    throw new Error(
      `Error invoking remote method 'project-file:${channel}': Error: No handler registered for 'project-file:${channel}'`,
    );
  };
  const desktop = {
    info: missing("info"),
    open: missing("open"),
    save: missing("save"),
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { kamikamiProjectFiles: desktop },
  });
  try {
    const access = new ProjectFileAccess();
    const restored = await access.restore();
    assert.match(restored.warning!, /Fully quit KamiKami and relaunch/);
    assert.doesNotMatch(restored.warning!, /Save will ask for a location/);
    await assert.rejects(
      access.save(initialProject),
      /Fully quit KamiKami and relaunch/,
    );
    await assert.rejects(access.open(), /Fully quit KamiKami and relaunch/);
    desktop.save = async () => {
      throw new Error("Permission denied");
    };
    await assert.rejects(
      access.save(initialProject),
      /^Error: Permission denied$/,
    );
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("desktop Save chooses a JSON once, overwrites atomically, and restores the destination", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "kamikami-project-save-"));
  try {
    let prompts = 0;
    const filename = path.join(dir, "My movie.json");
    const metadata = path.join(dir, "preferences", "destination.json");
    const dialogs = {
      save: async () => {
        prompts++;
        return filename;
      },
      open: async () => filename,
    };
    const files = new ProjectFiles(metadata, dialogs);
    assert.equal(await files.restore(), null);
    await files.save(projectJson(initialProject), "My movie");
    assert.equal(prompts, 1);
    const edited = { ...initialProject, name: "Edited movie" };
    await files.save(projectJson(edited), edited.name);
    assert.equal(prompts, 1);
    assert.equal(
      JSON.parse(await readFile(filename, "utf8")).name,
      edited.name,
    );
    assert.deepEqual((await readdir(dir)).sort(), [
      "My movie.json",
      "preferences",
    ]);
    const reopened = new ProjectFiles(metadata, dialogs);
    assert.deepEqual(await reopened.restore(), { name: "My movie.json" });
    await reopened.save(projectJson(initialProject), initialProject.name);
    assert.equal(prompts, 1);
    await unlink(filename);
    await reopened.save(projectJson(initialProject), initialProject.name);
    assert.equal(prompts, 2, "A removed file asks for a destination again");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("New project forgets the desktop destination so Save cannot overwrite the old file", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "kamikami-project-new-"));
  try {
    const old = path.join(dir, "Old movie.json");
    const fresh = path.join(dir, "Untitled project.json");
    const metadata = path.join(dir, "preferences", "destination.json");
    let target = old;
    const dialogs = { save: async () => target, open: async () => old };
    const files = new ProjectFiles(metadata, dialogs);
    await files.restore();
    await files.save(projectJson(initialProject), "Old movie");
    await files.forget();
    assert.equal(files.info(), null);
    const reopened = new ProjectFiles(metadata, dialogs);
    assert.equal(await reopened.restore(), null, "forgetting persists");
    target = fresh;
    const blank = blankProject({
      ...initialProject,
      width: 1080,
      height: 1920,
    });
    await files.save(projectJson(blank), blank.name);
    assert.equal(
      JSON.parse(await readFile(old, "utf8")).name,
      initialProject.name,
      "the old file is untouched",
    );
    assert.equal(JSON.parse(await readFile(fresh, "utf8")).layers.length, 0);
    // The blank project keeps the canvas format and starts with one empty layer.
    assert.deepEqual(
      [blank.width, blank.height, blank.fps, blank.layers, blank.effects],
      [1080, 1920, initialProject.fps, [], []],
    );
    assert.equal(blank.tracks!.length, 1);
    assert.deepEqual(validateProject(blank), blank);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("canceling or rejecting Open retains the previous destination; accepted Open becomes the Save target", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "kamikami-project-open-"));
  try {
    const first = path.join(dir, "first.json"),
      second = path.join(dir, "second.json");
    const original = projectJson(initialProject);
    await writeFile(second, original);
    let selected: string | null = first;
    const files = new ProjectFiles(path.join(dir, "preferences.json"), {
      save: async () => selected,
      open: async () => selected,
    });
    await files.restore();
    selected = null;
    assert.equal(await files.save(original, "Movie"), null);
    assert.equal(files.info(), null);
    selected = first;
    await files.save(original, "Movie");
    selected = null;
    assert.equal(await files.open(), null);
    assert.deepEqual(files.info(), { name: "first.json" });
    selected = second;
    const pending = await files.open();
    await assert.rejects(files.accept("wrong token"), /again/);
    assert.deepEqual(files.info(), { name: "first.json" });
    await files.accept(pending.token);
    await files.save(
      projectJson({ ...initialProject, name: "Updated second" }),
      "Movie",
    );
    assert.equal(await readFile(first, "utf8"), original);
    assert.equal(
      JSON.parse(await readFile(second, "utf8")).name,
      "Updated second",
    );
    await writeFile(first, "invalid JSON");
    selected = first;
    await assert.rejects(files.open());
    assert.deepEqual(files.info(), { name: "second.json" });
    await assert.rejects(files.save("{}", "Movie"), /KamiKami/);
    assert.equal(
      JSON.parse(await readFile(second, "utf8")).name,
      "Updated second",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("failed writes and concurrent native operations do not claim a saved project", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "kamikami-project-errors-"));
  try {
    let release!: (value: string | null) => void;
    const files = new ProjectFiles(path.join(dir, "preferences.json"), {
      save: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    });
    await files.restore();
    const saving = files.save(projectJson(initialProject), "Movie");
    await assert.rejects(
      files.save(projectJson(initialProject), "Movie"),
      /already in progress/,
    );
    const directory = path.join(dir, "directory.json");
    await mkdir(directory);
    release(directory);
    await assert.rejects(saving);
    assert.equal(files.info(), null);
    assert.deepEqual(await readdir(dir), ["directory.json"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("frontend validates an opened JSON before accepting its target and handles native Save cancellation", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  let accepts = 0,
    saves = 0,
    cancel = false;
  let text = "{}";
  const desktop = {
    info: async () => ({ file: { name: "previous.json" } }),
    open: async () => ({ token: "pending", name: "opened.json", text }),
    accept: async () => {
      accepts++;
      return { name: "opened.json" };
    },
    save: async (json: string) => {
      saves++;
      assert.equal(JSON.parse(json).version, 2);
      return cancel ? null : { name: "opened.json" };
    },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { kamikamiProjectFiles: desktop },
  });
  try {
    const access = new ProjectFileAccess();
    await access.restore();
    await assert.rejects(access.open());
    assert.equal(accepts, 0);
    text = projectJson(initialProject);
    assert.equal((await access.open())?.file.name, "opened.json");
    assert.equal(accepts, 1);
    assert.equal((await access.save(initialProject))?.name, "opened.json");
    cancel = true;
    assert.equal(await access.save(initialProject), null);
    assert.equal(saves, 2);
  } finally {
    if (originalWindow)
      Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("browser Save calls the picker from the gesture, reuses its handle, and aborts failed writes", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalDB = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
  let prompts = 0,
    writes = 0,
    aborts = 0,
    fail = false;
  let savedHandle: ProjectFileHandle | undefined;
  const handle = {
    name: "browser.json",
    getFile: async () =>
      new File([projectJson(initialProject)], "browser.json"),
    requestPermission: async () => "granted",
    createWritable: async () => ({
      write: async () => {
        if (fail) throw new Error("Disk full");
        writes++;
      },
      close: async () => {},
      abort: async () => {
        aborts++;
      },
    }),
  } as unknown as ProjectFileHandle;
  const database = {
    open: () => {
      const request: any = {};
      queueMicrotask(() => {
        request.result = {
          close: () => {},
          transaction: () => {
            const transaction: any = {
              objectStore: () => ({
                put: (value: ProjectFileHandle) => {
                  savedHandle = value;
                  return {};
                },
                get: () => ({ result: savedHandle }),
              }),
            };
            queueMicrotask(() => transaction.oncomplete());
            return transaction;
          },
        };
        request.onsuccess();
      });
      return request;
    },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      showSaveFilePicker: async () => {
        prompts++;
        return handle;
      },
    },
  });
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: database,
  });
  try {
    const access = new ProjectFileAccess();
    await access.restore();
    const saving = access.save(initialProject);
    assert.equal(
      prompts,
      1,
      "Picker called synchronously before activation can be lost",
    );
    await saving;
    await access.save(initialProject);
    assert.equal(prompts, 1);
    assert.equal(writes, 2);
    const restored = new ProjectFileAccess();
    assert.equal((await restored.restore()).file?.name, "browser.json");
    fail = true;
    await assert.rejects(restored.save(initialProject), /Disk full/);
    assert.equal(aborts, 1);
    assert.equal(prompts, 1);
  } finally {
    if (originalWindow)
      Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalDB) Object.defineProperty(globalThis, "indexedDB", originalDB);
    else Reflect.deleteProperty(globalThis, "indexedDB");
  }
});
