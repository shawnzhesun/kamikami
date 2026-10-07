import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
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
import { initialProject } from "../src/model";
import {
  ProjectFileAccess,
  projectJson,
  type ProjectFileHandle,
} from "../src/project-files";
const { ProjectFiles } = createRequire(import.meta.url)(
  "../electron/project-files.cjs",
);

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
      assert.equal(JSON.parse(json).version, 1);
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
