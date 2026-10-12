import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  PROBE_ANALYZER_VERSION,
  analysisTiers,
  entrySummary,
  keepManual,
  type AnalysisTier,
  type AssetAnalysis,
} from "../../src/asset-analysis";
import { mediaPath, mediaType } from "../../src/media";
import { AnalysisStore } from "./store";
import { probeAsset, probeParamsHash, sha256File } from "./probe";

export type AnalysisJob = {
  id: string;
  src: string;
  tier: AnalysisTier;
  prompt?: string;
  status: "queued" | "running" | "done" | "error" | "canceled";
  stage?: string;
  error?: string;
  createdAt: string;
};
/** Later stages (Transcribe, Look, Summarize) plug in here per tier. */
export type AnalysisStage = {
  name: string;
  tiers: AnalysisTier[];
  /** False when the stage does not apply (e.g. transcription is turned off). */
  applies?: (analysis: AssetAnalysis) => boolean | Promise<boolean>;
  run: (
    analysis: AssetAnalysis,
    context: {
      file: string;
      src: string;
      name: string;
      tier: AnalysisTier;
      signal: AbortSignal;
      /** Transcription hint, e.g. pasted lyrics. */
      prompt?: string;
    },
  ) => Promise<AssetAnalysis>;
};

const rank = (tier: AnalysisTier) => analysisTiers.indexOf(tier);

export class AnalysisQueue {
  private jobs: AnalysisJob[] = [];
  private running = new Map<string, AbortController>();
  private persist = Promise.resolve();
  private listeners = new Set<(job: AnalysisJob) => void>();
  constructor(
    private store: AnalysisStore,
    private workspace: string,
    private stages: AnalysisStage[] = [],
    private concurrency = 2,
    private nameOf: (src: string) => Promise<string> = async (src) => src,
  ) {}
  /** Resume jobs that were queued or interrupted when the service stopped. */
  async load() {
    try {
      const saved = JSON.parse(
        await readFile(path.join(this.store.directory, "queue.json"), "utf8"),
      ) as AnalysisJob[];
      this.jobs = saved
        .filter((j) => mediaPath.test(j.src) && analysisTiers.includes(j.tier))
        .filter((j) => j.status === "queued" || j.status === "running")
        .map((j) => ({ ...j, status: "queued" as const, stage: undefined }));
    } catch {
      this.jobs = [];
    }
    this.pump();
  }
  onChange(listener: (job: AnalysisJob) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  list() {
    return this.jobs.slice(-200);
  }
  private emit(job: AnalysisJob) {
    for (const listener of this.listeners) listener(job);
    this.save();
  }
  private save() {
    const pending = this.jobs.filter(
      (j) => j.status === "queued" || j.status === "running",
    );
    this.persist = this.persist
      .catch(() => {})
      .then(async () => {
        const { writeFile, mkdir, rename } = await import("node:fs/promises");
        await mkdir(this.store.directory, { recursive: true });
        const temp = path.join(
          this.store.directory,
          `.queue-${randomUUID()}.tmp`,
        );
        await writeFile(temp, JSON.stringify(pending));
        await rename(temp, path.join(this.store.directory, "queue.json"));
      });
  }
  /** Queue analysis; an already-pending job for the same src is upgraded, not duplicated. */
  enqueue(
    src: string,
    tier: AnalysisTier = "probe",
    options: { prompt?: string } = {},
  ) {
    if (!mediaPath.test(src)) throw new Error("Invalid media path");
    const pending = this.jobs.find(
      (j) => j.src === src && (j.status === "queued" || j.status === "running"),
    );
    if (pending) {
      if (
        pending.status === "queued" &&
        (rank(tier) > rank(pending.tier) || options.prompt)
      ) {
        if (rank(tier) > rank(pending.tier)) pending.tier = tier;
        if (options.prompt) pending.prompt = options.prompt;
        this.emit(pending);
      }
      return pending;
    }
    const job: AnalysisJob = {
      id: randomUUID(),
      src,
      tier,
      ...(options.prompt ? { prompt: options.prompt } : {}),
      status: "queued",
      createdAt: new Date().toISOString(),
    };
    this.jobs.push(job);
    void this.store.setEntry(src, (e) => ({ ...e, status: "queued", tier }));
    this.emit(job);
    this.pump();
    return job;
  }
  cancel(id?: string) {
    for (const job of this.jobs)
      if (
        (!id || job.id === id) &&
        (job.status === "queued" || job.status === "running")
      ) {
        this.running.get(job.id)?.abort();
        if (job.status === "queued") {
          job.status = "canceled";
          void this.store.setEntry(job.src, (e) => ({
            ...e,
            status: e.sha256 ? "partial" : "none",
          }));
          this.emit(job);
        }
      }
  }
  /** Resolves once nothing is queued or running (tests and shutdown). */
  async idle() {
    while (
      this.jobs.some((j) => j.status === "queued" || j.status === "running")
    )
      await new Promise((r) => setTimeout(r, 25));
    await this.persist;
  }
  private pump() {
    while (this.running.size < this.concurrency) {
      const job = this.jobs.find((j) => j.status === "queued");
      if (!job) return;
      const controller = new AbortController();
      this.running.set(job.id, controller);
      job.status = "running";
      this.emit(job);
      void this.process(job, controller.signal).finally(() => {
        this.running.delete(job.id);
        this.pump();
      });
    }
  }
  private async process(job: AnalysisJob, signal: AbortSignal) {
    const file = path.join(this.workspace, job.src);
    try {
      await this.store.setEntry(job.src, (e) => ({
        ...e,
        status: "running",
        tier: job.tier,
      }));
      job.stage = "probe";
      this.emit(job);
      const sha256 = await sha256File(file, signal);
      let analysis = await this.store.read(sha256);
      // Reuse cached probe results when the content and analyzer settings match.
      const cached = analysis?.provenance.probe;
      if (
        !analysis ||
        cached?.version !== PROBE_ANALYZER_VERSION ||
        cached?.paramsHash !== probeParamsHash()
      )
        analysis = await probeAsset(file, mediaType(job.src), signal, sha256);
      // Save the probe first so later stage failures never lose it. Every
      // write keeps manual metadata written meanwhile (keepManual).
      const fresh = analysis;
      analysis = await this.store.update(sha256, (latest) =>
        keepManual(latest, fresh),
      );
      const name = await this.nameOf(job.src);
      const problems: string[] = [];
      for (const stage of this.stages.filter((s) =>
        s.tiers.includes(job.tier),
      )) {
        if (stage.applies && !(await stage.applies(analysis))) continue;
        job.stage = stage.name;
        this.emit(job);
        try {
          const result = await stage.run(analysis, {
            file,
            src: job.src,
            name,
            tier: job.tier,
            signal,
            prompt: job.prompt,
          });
          analysis = await this.store.update(sha256, (latest) =>
            keepManual(latest, result),
          );
        } catch (error) {
          if (signal.aborted) throw error;
          problems.push(String((error as Error).message).slice(0, 200));
        }
      }
      await this.store.setEntry(job.src, () => ({
        sha256,
        status: problems.length ? "partial" : "ready",
        tier: job.tier,
        updatedAt: new Date().toISOString(),
        summary: entrySummary(analysis!),
        ...(problems.length ? { error: problems.join(" ").slice(0, 400) } : {}),
      }));
      job.status = "done";
      job.stage = undefined;
    } catch (error) {
      const canceled = signal.aborted;
      job.status = canceled ? "canceled" : "error";
      job.error = canceled
        ? undefined
        : String((error as Error).message).slice(0, 400);
      await this.store.setEntry(job.src, (e) => ({
        ...e,
        status: canceled ? (e.sha256 ? "partial" : "none") : "error",
        ...(canceled ? {} : { error: job.error }),
      }));
    }
    this.emit(job);
  }
}
