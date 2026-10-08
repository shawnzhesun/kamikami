const {
  readFile,
  writeFile,
  rename,
  unlink,
  mkdir,
  stat,
} = require("node:fs/promises");
const { randomUUID, createHash } = require("node:crypto");
const path = require("node:path");

const MAX_BYTES = 2 * 1024 * 1024;
function checkJson(text) {
  if (typeof text !== "string" || Buffer.byteLength(text) > MAX_BYTES)
    throw new Error("Project JSON must be smaller than 2 MB.");
  const value = JSON.parse(text);
  if (
    ![1, 2].includes(value?.version) ||
    !Array.isArray(value.layers) ||
    typeof value.name !== "string"
  )
    throw new Error("Choose a KamiKami project JSON file.");
}
async function atomicWrite(filename, text) {
  const temporary = path.join(
    path.dirname(filename),
    `.${path.basename(filename)}-${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporary, text, { encoding: "utf8", flag: "wx" });
    await rename(temporary, filename);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

/** Only native dialogs can grant a destination. The renderer never supplies paths. */
class ProjectFiles {
  constructor(metadata, dialogs) {
    this.metadata = metadata;
    this.dialogs = dialogs;
    this.destination = null;
    this.pending = null;
    this.busy = false;
  }
  async restore() {
    try {
      const { destination } = JSON.parse(await readFile(this.metadata, "utf8"));
      if (
        typeof destination === "string" &&
        path.isAbsolute(destination) &&
        /\.json$/i.test(destination)
      )
        this.destination = destination;
    } catch (error) {
      if (error.code !== "ENOENT")
        throw new Error("Could not read the saved project file location.");
    }
    return this.info();
  }
  info() {
    return this.destination ? { name: path.basename(this.destination) } : null;
  }
  async remember(destination) {
    await mkdir(path.dirname(this.metadata), { recursive: true });
    await atomicWrite(this.metadata, JSON.stringify({ destination }));
    this.destination = destination;
  }
  async open() {
    if (this.busy)
      throw new Error("A project file operation is already in progress.");
    this.busy = true;
    try {
      const filename = await this.dialogs.open();
      this.pending = null;
      if (!filename) return null;
      if (!/\.json$/i.test(filename))
        throw new Error("Choose a JSON project file.");
      if ((await stat(filename)).size > MAX_BYTES)
        throw new Error("Project JSON must be smaller than 2 MB.");
      const text = await readFile(filename, "utf8");
      checkJson(text);
      const token = randomUUID();
      this.pending = { token, filename };
      return { token, name: path.basename(filename), text };
    } finally {
      this.busy = false;
    }
  }
  async accept(token) {
    if (this.busy)
      throw new Error("A project file operation is already in progress.");
    if (!this.pending || this.pending.token !== token)
      throw new Error("Open the project file again.");
    this.busy = true;
    try {
      await this.remember(this.pending.filename);
      this.pending = null;
      return this.info();
    } finally {
      this.busy = false;
    }
  }
  async save(text, suggestedName) {
    if (this.busy)
      throw new Error("A project file operation is already in progress.");
    checkJson(text);
    this.busy = true;
    try {
      let destination = this.destination;
      if (destination) {
        try {
          await stat(destination);
        } catch (e) {
          if (e.code === "ENOENT") destination = null;
          else throw e;
        }
      }
      if (!destination) {
        const name =
          typeof suggestedName === "string"
            ? suggestedName
                .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
                .slice(0, 100)
            : "KamiKami";
        destination = await this.dialogs.save(
          name.replace(/\.json$/i, "") + ".json",
        );
        if (!destination) return null;
        if (!/\.json$/i.test(destination)) destination += ".json";
      }
      await atomicWrite(destination, text);
      // The file has been written even if persisting its location fails.
      let warning;
      try {
        await this.remember(destination);
      } catch {
        this.destination = destination;
        warning =
          "File saved, but its location could not be remembered for the next session.";
      }
      return { ...this.info(), warning };
    } finally {
      this.busy = false;
    }
  }
}

function installProjectFiles() {
  const { ipcMain, dialog, BrowserWindow, app } = require("electron");
  const workspace = createHash("sha256")
    .update(path.resolve(__dirname, ".."))
    .digest("hex")
    .slice(0, 16);
  let owner;
  const files = new ProjectFiles(
    path.join(app.getPath("userData"), `project-file-${workspace}.json`),
    {
      open: async () => {
        const result = await dialog.showOpenDialog(owner, {
          title: "Open project",
          filters: [{ name: "KamiKami project", extensions: ["json"] }],
          properties: ["openFile"],
        });
        return result.canceled ? null : result.filePaths[0];
      },
      save: async (suggestedName) => {
        const result = await dialog.showSaveDialog(owner, {
          title: "Save project",
          defaultPath: suggestedName,
          filters: [{ name: "KamiKami project", extensions: ["json"] }],
          properties: ["createDirectory", "showOverwriteConfirmation"],
        });
        return result.canceled ? null : result.filePath;
      },
    },
  );
  // Defer failures to the UI; file-location metadata must not prevent app startup.
  const restored = files.restore().then(
    () => null,
    (e) => e.message,
  );
  for (const [channel, handler] of Object.entries({
    info: async () => ({ file: files.info(), warning: await restored }),
    open: () => files.open(),
    accept: (token) => files.accept(token),
    save: (text, name) => files.save(text, name),
  })) {
    ipcMain.handle(`project-file:${channel}`, async (event, ...args) => {
      if (
        !event.senderFrame ||
        event.senderFrame !== event.sender.mainFrame ||
        new URL(event.senderFrame.url).origin !== "http://127.0.0.1:5173"
      )
        throw new Error("Only the editor can access project files.");
      owner = BrowserWindow.fromWebContents(event.sender);
      await restored;
      return handler(...args);
    });
  }
}
module.exports = { ProjectFiles, installProjectFiles };
