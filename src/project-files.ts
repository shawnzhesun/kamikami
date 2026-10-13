import { validateProject, type Project } from "./model";

type FileInfo = { name: string };
type FileResult = FileInfo & { warning?: string };
type Permission = { mode: "readwrite" };
export interface ProjectFileHandle extends FileSystemFileHandle {
  queryPermission(options: Permission): Promise<PermissionState>;
  requestPermission(options: Permission): Promise<PermissionState>;
}
declare global {
  interface Window {
    kamikamiProjectFiles?: {
      info(): Promise<{ file: FileInfo | null; warning?: string }>;
      open(): Promise<{ text: string; name: string; token: string } | null>;
      accept(token: string): Promise<FileInfo>;
      save(text: string, name: string): Promise<FileResult | null>;
      forget(): Promise<void>;
    };
    showSaveFilePicker?: (options: {
      suggestedName: string;
      types: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<ProjectFileHandle>;
    showOpenFilePicker?: (options: {
      multiple: false;
      types: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<ProjectFileHandle[]>;
  }
}

const types = [
  {
    description: "KamiKami project JSON",
    accept: { "application/json": [".json"] },
  },
];
const abort = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";
function projectFileError(error: unknown): unknown {
  if (
    error instanceof Error &&
    /No handler registered for ['"]project-file:(info|open|accept|save|forget)['"]/.test(
      error.message,
    )
  ) {
    return new Error(
      "The desktop app needs a restart to load project-file support. Fully quit KamiKami and relaunch it, then try again. Reloading the editor window is not enough.",
    );
  }
  return error;
}
export const projectJson = (project: Project) =>
  JSON.stringify(validateProject(project), null, 2) + "\n";

/** A handle stores it, `null` forgets it, no argument reads it. */
async function handleStore(
  handle?: ProjectFileHandle | null,
): Promise<ProjectFileHandle | undefined> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("kamikami-project-files", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(
        "files",
        handle !== undefined ? "readwrite" : "readonly",
      );
      const store = transaction.objectStore("files");
      const operation = handle
        ? store.put(handle, "current")
        : handle === null
          ? store.delete("current")
          : store.get("current");
      transaction.oncomplete = () => {
        db.close();
        resolve(
          handle === null
            ? undefined
            : (handle ?? (operation.result as ProjectFileHandle)),
        );
      };
      transaction.onabort = () => {
        db.close();
        reject(transaction.error);
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    };
  });
}

/** Native paths stay in Electron; browser destinations are user-granted file handles. */
export class ProjectFileAccess {
  private handle: ProjectFileHandle | undefined;
  private file: FileInfo | null = null;
  private busy = false;
  private initialized = false;
  async restore(): Promise<{ file: FileInfo | null; warning?: string }> {
    try {
      if (window.kamikamiProjectFiles) {
        const result = await window.kamikamiProjectFiles.info();
        this.file = result.file;
        return result;
      }
      this.handle = await handleStore();
      this.file = this.handle ? { name: this.handle.name } : null;
      return { file: this.file };
    } catch (error) {
      const translated = projectFileError(error);
      return {
        file: null,
        warning:
          translated !== error && translated instanceof Error
            ? translated.message
            : "Could not restore the project file location. Save will ask for a location.",
      };
    } finally {
      this.initialized = true;
    }
  }
  private lock() {
    if (!this.initialized)
      throw new Error("The project file location is still loading.");
    if (this.busy)
      throw new Error("A project file operation is already in progress.");
    this.busy = true;
  }
  async open(): Promise<{
    project: Project;
    file: FileInfo;
    warning?: string;
  } | null> {
    this.lock();
    try {
      if (window.kamikamiProjectFiles) {
        const result = await window.kamikamiProjectFiles.open();
        if (!result) return null;
        // Invalid projects must never replace the current save destination.
        const project = validateProject(JSON.parse(result.text));
        const file = await window.kamikamiProjectFiles.accept(result.token);
        this.file = file;
        return { project, file };
      }
      if (!window.showOpenFilePicker)
        throw new Error(
          "Open projects in the desktop app or a browser with file access support, such as Chrome or Edge.",
        );
      const [handle] = await window.showOpenFilePicker({
        types,
        multiple: false,
      });
      if (!handle) return null;
      const file = await handle.getFile();
      if (file.size > 2 * 1024 * 1024)
        throw new Error("Project JSON must be smaller than 2 MB.");
      const project = validateProject(JSON.parse(await file.text()));
      // Persist before accepting the new project, so failed opens retain the old target.
      await handleStore(handle);
      this.handle = handle;
      this.file = { name: handle.name };
      return { project, file: this.file };
    } catch (error) {
      if (abort(error)) return null;
      throw projectFileError(error);
    } finally {
      this.busy = false;
    }
  }
  /** Detach from the current file so the next Save asks for a new location. */
  async forget() {
    this.lock();
    try {
      if (window.kamikamiProjectFiles)
        await window.kamikamiProjectFiles.forget();
      else await handleStore(null);
      this.handle = undefined;
      this.file = null;
    } catch (error) {
      throw projectFileError(error);
    } finally {
      this.busy = false;
    }
  }
  async save(project: Project): Promise<FileResult | null> {
    this.lock();
    try {
      const text = projectJson(project);
      if (window.kamikamiProjectFiles) {
        const result = await window.kamikamiProjectFiles.save(
          text,
          project.name,
        );
        if (result) this.file = result;
        return result;
      }
      if (!window.showSaveFilePicker)
        throw new Error(
          "Saving to a chosen file requires the desktop app or a browser with file access support, such as Chrome or Edge.",
        );
      let handle = this.handle;
      if (handle) {
        // Request access from the Save gesture before any unrelated asynchronous work.
        const permission = await handle.requestPermission({
          mode: "readwrite",
        });
        if (permission !== "granted")
          throw new Error(
            "File access was not granted. Your project is still recovered locally.",
          );
        try {
          await handle.getFile();
        } catch (e) {
          if ((e as Error).name === "NotFoundError") handle = undefined;
          else throw e;
        }
      }
      if (!handle) {
        const name = project.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-");
        handle = await window.showSaveFilePicker({
          suggestedName: name + ".json",
          types,
        });
      }
      const writable = await handle.createWritable();
      try {
        await writable.write(text);
        await writable.close();
      } catch (error) {
        await writable.abort().catch(() => {});
        throw error;
      }
      this.handle = handle;
      this.file = { name: handle.name };
      let warning;
      try {
        await handleStore(handle);
      } catch {
        warning =
          "File saved, but its location could not be remembered for the next session.";
      }
      return { ...this.file, warning };
    } catch (error) {
      if (abort(error)) return null;
      throw projectFileError(error);
    } finally {
      this.busy = false;
    }
  }
}
