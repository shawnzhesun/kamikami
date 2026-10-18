import { mkdirSync, rmSync, readdirSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  makeCancelSignal,
  openBrowser,
  renderFrames,
  selectComposition,
  type ChromiumOptions,
  type HeadlessBrowser,
} from "@remotion/renderer";
import {
  chunkCount,
  chunkKeys,
  chunkOf,
  chunkRange,
  previewScale,
} from "../src/preview-cache";
import type { Project } from "../src/model";

/** Consecutive chunks rendered by one browser pass (about 16 seconds). */
const MAX_RUN = 8;
/** Rendering stops when the editor hasn't asked for it for this long. */
const HEARTBEAT_MS = 10_000;
const BROWSER_IDLE_MS = 30_000;

type Plan = {
  project: Project;
  keys: string[];
  /** Chunk indices in render order: from the playhead to the end, then the start. */
  order: number[];
  render: boolean;
  touched: number;
};
type Options = {
  /** Shared by every session; each service owns the subfolder named by its pid. */
  root: string;
  limitBytes: number;
  serveUrl: () => Promise<string>;
  browserExecutable: string | null;
  chromiumOptions: ChromiumOptions;
  concurrency: number;
  mediaOrigin: string;
  /** True while an export runs; the cache waits instead of competing for the GPU. */
  busy: () => boolean;
};

const pidAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
};

/**
 * Preview frames rendered by the export pipeline, kept on disk only for the
 * life of this service: the folder is removed when the service exits, and
 * folders left by a crashed service are removed on the next start.
 */
export class PreviewCache {
  readonly dir: string;
  private ready = new Map<string, { bytes: number; used: number }>();
  private failed = new Set<string>();
  private plan: Plan | null = null;
  private running = false;
  /** Keys of the chunks the current browser pass is drawing. */
  private drawing: string[] = [];
  private cancel: (() => void) | null = null;
  private browser: Promise<HeadlessBrowser> | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  private composition: {
    id: string;
    value: Awaited<ReturnType<typeof selectComposition>>;
  } | null = null;
  error = "";

  constructor(private options: Options) {
    this.dir = path.join(options.root, String(process.pid));
  }
  /** Removes folders of services that are no longer running, then this one's. */
  open() {
    mkdirSync(this.options.root, { recursive: true });
    for (const name of readdirSync(this.options.root))
      if (
        !/^\d+$/.test(name) ||
        !pidAlive(Number(name)) ||
        name === String(process.pid)
      )
        rmSync(path.join(this.options.root, name), {
          recursive: true,
          force: true,
        });
    mkdirSync(this.dir, { recursive: true });
  }
  /** Synchronous, so it can run in a process "exit" handler. */
  removeSync() {
    this.cancel?.();
    rmSync(this.dir, { recursive: true, force: true });
  }
  async clear() {
    this.cancel?.();
    this.ready.clear();
    this.failed.clear();
    this.error = "";
    await rm(this.dir, { recursive: true, force: true });
    await mkdir(this.dir, { recursive: true });
  }

  /**
   * The editor's current project and playhead. With `render`, missing chunks
   * render in the background from the playhead on; without it (playback, a
   * drag) rendering stops so it doesn't slow the editor down.
   */
  setPlan(
    project: Project,
    missingSources: string[],
    from: number,
    render: boolean,
  ) {
    const keys = chunkKeys(project, missingSources);
    const n = chunkCount(project),
      start = Math.min(n - 1, Math.max(0, chunkOf(project, from)));
    const order = Array.from({ length: n }, (_, i) => (start + i) % n);
    this.plan = { project, keys, order, render, touched: Date.now() };
    // Keep drawing only while every chunk of the pass is still wanted.
    if (
      this.drawing.length &&
      (!render || this.drawing.some((k) => !keys.includes(k)))
    )
      this.cancel?.();
    if (render) void this.work();
    return this.status();
  }
  /** Playback or a drag started: free the GPU right away. */
  pause() {
    if (this.plan) this.plan.render = false;
    this.cancel?.();
  }
  /** Drops the pass in progress; the cache resumes once `busy` clears. */
  interrupt() {
    this.cancel?.();
  }
  /** Polled by the editor; it also keeps the plan alive. */
  status() {
    if (this.plan) this.plan.touched = Date.now();
    const keys = this.plan?.keys ?? [];
    let bytes = 0;
    for (const entry of this.ready.values()) bytes += entry.bytes;
    return {
      ready: keys.filter((k) => this.ready.has(k)),
      drawing: this.drawing,
      rendering: this.running,
      error: this.error,
      bytes,
      limitBytes: this.options.limitBytes,
    };
  }
  /** The file of one cached frame, or null when the chunk isn't cached. */
  frame(key: string, index: number) {
    const entry = this.ready.get(key);
    if (!entry) return null;
    entry.used = Date.now();
    return path.join(this.dir, key, `${index}.jpg`);
  }

  private async work() {
    if (this.running) return;
    this.running = true;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    try {
      for (;;) {
        const plan = this.plan;
        if (!plan?.render || Date.now() - plan.touched > HEARTBEAT_MS) break;
        if (this.options.busy()) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        const run = this.nextRun(plan);
        if (!run) break;
        await this.renderRun(plan, run);
      }
    } catch (e) {
      // Nothing awaits this loop, so an error here would end the service.
      this.error = (e as Error).message;
    } finally {
      this.running = false;
      this.idleTimer = setTimeout(
        () => void this.closeBrowser(),
        BROWSER_IDLE_MS,
      );
    }
  }
  private nextRun(plan: Plan): number[] | null {
    const missing = (i: number) =>
      !this.ready.has(plan.keys[i]) && !this.failed.has(plan.keys[i]);
    const at = plan.order.findIndex(missing);
    if (at < 0) return null;
    const run = [plan.order[at]];
    while (
      run.length < MAX_RUN &&
      plan.order[at + run.length] === run.at(-1)! + 1 &&
      missing(run.at(-1)! + 1)
    )
      run.push(run.at(-1)! + 1);
    return run;
  }
  private async renderRun(plan: Plan, run: number[]) {
    const { project, keys } = plan;
    const first = chunkRange(project, run[0])[0],
      last = chunkRange(project, run.at(-1)!)[1];
    const written = new Map<number, number>(),
      sizes = new Map<number, number>();
    const { cancelSignal, cancel } = makeCancelSignal();
    let cancelled = false;
    this.cancel = () => {
      cancelled = true;
      cancel();
    };
    this.drawing = run.map((i) => keys[i]);
    try {
      await Promise.all(
        run.map((i) =>
          mkdir(path.join(this.dir, keys[i] + ".part"), { recursive: true }),
        ),
      );
      const browser = await this.openBrowser(),
        serveUrl = await this.options.serveUrl(),
        inputProps = { project, mediaOrigin: this.options.mediaOrigin };
      // The composition only changes with the frame setup and length.
      const id = JSON.stringify([
        project.width,
        project.height,
        project.fps,
        project.duration,
      ]);
      if (this.composition?.id !== id)
        this.composition = {
          id,
          value: await selectComposition({
            serveUrl,
            id: "KamiKami",
            inputProps,
            browserExecutable: this.options.browserExecutable,
            chromiumOptions: this.options.chromiumOptions,
            puppeteerInstance: browser,
          }),
        };
      if (cancelled) return;
      await renderFrames({
        // A selected composition carries the props it was selected with, and
        // renderFrames draws those, so pass this plan's project.
        composition: { ...this.composition.value, props: inputProps },
        serveUrl,
        inputProps,
        frameRange: [first, last],
        imageFormat: "jpeg",
        jpegQuality: 80,
        scale: previewScale(project),
        concurrency: this.options.concurrency,
        puppeteerInstance: browser,
        browserExecutable: this.options.browserExecutable,
        chromiumOptions: this.options.chromiumOptions,
        cancelSignal,
        outputDir: null,
        onStart: () => {},
        onFrameUpdate: () => {},
        onFrameBuffer: async (buffer, frame) => {
          if (cancelled) return;
          const chunk = chunkOf(project, frame),
            [start, end] = chunkRange(project, chunk),
            key = keys[chunk];
          await writeFile(
            path.join(this.dir, key + ".part", `${frame - start}.jpg`),
            buffer,
          );
          written.set(chunk, (written.get(chunk) ?? 0) + 1);
          sizes.set(chunk, (sizes.get(chunk) ?? 0) + buffer.length);
          if (written.get(chunk) !== end - start + 1) return;
          // A chunk is used only once all of its frames are on disk.
          await rm(path.join(this.dir, key), { recursive: true, force: true });
          await rename(
            path.join(this.dir, key + ".part"),
            path.join(this.dir, key),
          );
          this.ready.set(key, { bytes: sizes.get(chunk)!, used: Date.now() });
          this.drawing = this.drawing.filter((k) => k !== key);
          await this.evict();
        },
      });
      this.error = "";
    } catch (e) {
      if (!cancelled) {
        this.error = (e as Error).message;
        // Skip chunks that fail, so one broken frame doesn't loop forever.
        for (const i of run)
          if (!this.ready.has(keys[i])) this.failed.add(keys[i]);
        await this.closeBrowser();
      }
    } finally {
      this.cancel = null;
      this.drawing = [];
      // After a cancel, frame writes can still land while the folder is
      // removed (ENOTEMPTY); a leftover goes with the session folder.
      await Promise.all(
        run.map((i) =>
          rm(path.join(this.dir, keys[i] + ".part"), {
            recursive: true,
            force: true,
            maxRetries: 3,
          }).catch(() => {}),
        ),
      );
    }
  }
  /** Least recently used chunks go first, chunks of the current project last. */
  private async evict() {
    let total = 0;
    for (const entry of this.ready.values()) total += entry.bytes;
    if (total <= this.options.limitBytes) return;
    const current = new Set(this.plan?.keys ?? []);
    const victims = [...this.ready.entries()].sort(
      ([a, x], [b, y]) =>
        Number(current.has(a)) - Number(current.has(b)) || x.used - y.used,
    );
    for (const [key, entry] of victims) {
      if (total <= this.options.limitBytes * 0.9) break;
      if (this.drawing.includes(key)) continue;
      this.ready.delete(key);
      total -= entry.bytes;
      await rm(path.join(this.dir, key), { recursive: true, force: true });
    }
  }
  private openBrowser() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.browser ??= openBrowser("chrome", {
      browserExecutable: this.options.browserExecutable,
      chromiumOptions: this.options.chromiumOptions,
    }).catch((e) => {
      this.browser = null;
      throw e;
    });
    return this.browser;
  }
  private async closeBrowser() {
    const browser = this.browser;
    this.browser = null;
    this.composition = null;
    await browser?.then((b) => b.close({ silent: true })).catch(() => {});
  }
}
