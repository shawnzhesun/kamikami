import { randomUUID } from "node:crypto";
import { readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { ConnectionSchema, OPENAI_BASE_URL } from "../src/assistant-connection";
import type {
  FunctionTool,
  ResponseInputItem,
} from "openai/resources/responses/responses";
import { editorTools } from "./editor-tools";
import { runTool, toolError, type ToolContext } from "./tool-runner";
import { agentConventions } from "./agent-conventions";
import { serviceOrigin } from "./service-config";
import { EditorBridge } from "./editor-bridge";
import type { MediaAsset } from "../src/media";
import { respond, type ModelRequest, type ModelReply } from "./assistant-model";
import type {
  AssistantState,
  AssistantMessage,
  AssistantStep,
} from "../src/assistant";
import type { Project } from "../src/model";

const SettingsSchema = z.object({
  name: ConnectionSchema.shape.name.unwrap().optional(),
  baseURL: ConnectionSchema.shape.baseURL.unwrap().optional(),
  apiMode: ConnectionSchema.shape.apiMode.unwrap().optional(),
  reuseKey: z.boolean().default(false),
  model: ConnectionSchema.shape.model,
  apiKey: z.string().trim().min(1).max(1000).optional(),
  keyStorage: z.enum(["session", "secure"]).default("session"),
});
const MessageSchema = z.object({
  text: z.string().trim().min(1).max(8000),
  selectedLayerIds: z.array(z.string().max(100)).max(40).default([]),
  frame: z.number().int().min(0),
  attachments: z
    .array(z.string().regex(/^\/media\/[a-zA-Z0-9_.-]+$/))
    .max(10)
    .default([]),
});
type Snapshot = {
  project: Project;
  revision: string;
  selectedLayerIds: string[];
  frame: number;
};
const labels: Record<string, string> = {
  create_track: "Creating a layer",
  update_track: "Updating a layer",
  delete_track: "Deleting a layer",
  reorder_tracks: "Reordering layers",
  get_project: "Reading the composition",
  get_capabilities: "Checking editing controls",
  get_media_library: "Browsing media",
  get_effect_library: "Browsing effects",
  find_effects: "Searching effects",
  describe_effect: "Reading an effect",
  update_layer: "Updating a clip",
  add_text: "Adding a title",
  add_shape: "Adding a shape",
  add_backdrop: "Adding a backdrop",
  apply_project: "Updating the composition",
  reorder_layers: "Reordering layers",
  select_layers: "Selecting clips",
  set_playhead: "Moving the playhead",
  undo: "Undoing an edit",
  redo: "Restoring an edit",
  save_project: "Saving the project",
  import_media: "Importing media",
  analyze_media: "Inspecting media",
  add_media: "Adding media to the timeline",
  delete_media: "Moving media to trash",
  restore_media: "Restoring media",
  relink_media: "Relinking missing media",
  delete_layers: "Removing clips",
  duplicate_layers: "Duplicating clips",
  move_clips: "Moving clips",
  trim_clip: "Trimming a clip",
  ripple_delete: "Ripple deleting",
  ripple_delete_clips: "Ripple deleting clips",
  ripple_insert: "Inserting a gap",
  cut_source_ranges: "Cutting source ranges",
  apply_edit_list: "Assembling an edit",
  crossfade: "Adding a crossfade",
  detach_audio: "Detaching audio",
  view_timeline_range: "Reviewing the cut",
  get_asset_analysis: "Reading asset analysis",
  search_assets: "Searching media",
  set_asset_metadata: "Saving asset descriptions",
  view_asset_range: "Viewing a media range",
  analyze_assets: "Analyzing media",
  set_keyframes: "Animating with keyframes",
  split_clips: "Splitting clips",
  set_project_settings: "Updating project settings",
  set_playback: "Controlling playback",
  create_effect: "Creating an effect",
  update_effect: "Refining an effect preset",
  update_effect_instance: "Adjusting an applied effect",
  apply_effect: "Applying an effect",
  remove_effect: "Removing an effect",
  save_user_effect: "Saving to My effects",
  import_effect_bundle: "Importing an effect",
  export_effect_bundle: "Preparing an effect bundle",
  render_frame: "Rendering a preview",
  get_render: "Checking a preview",
  export_video: "Starting video export",
  get_export: "Checking video export",
};
export const assistantTools: FunctionTool[] = editorTools.map(
  ({ name, description, input }) => ({
    type: "function",
    name,
    description,
    parameters: z.toJSONSchema(z.object(input)) as Record<string, unknown>,
    strict: false,
  }),
);
const instructions = [
  "You are KamiKami's native video editing assistant. Help the user edit their open project with the supplied tools. Be brief, concrete and friendly. Act on clear editing requests; ask a short question when the target or creative intent is genuinely ambiguous. Explain unsupported requests honestly.",
  "",
  "IN THE APP",
  '- Each message carries the selected element IDs and the playhead; "this clip" means the selection. Selecting is not an edit.',
  "- Run edits one at a time and don't retry an error repeatedly. Consecutive edits in one request share one undo step; a manual edit breaks the group. Don't call undo for a vague rollback: read the project and respect manual changes.",
  "- The context lists each asset with a one-line analysis summary.",
  "- Media comes from the library, the user's paperclip attachments, or import_media with an absolute path the user gave. You can't browse files or the web.",
  "- The app asks the user before deleting elements, tracks or used media, before edits that remove elements or shorten the project, before paid analysis, and before each import. Never describe a declined action as done.",
  "- PNG tool images are real rendered frames; review them when judging visual output.",
  "- Finish with a short summary of what actually changed; leave out IDs, revisions and tool names unless asked.",
  "",
  agentConventions,
].join("\n");

export class AssistantService {
  private messages: AssistantMessage[] = [];
  private active: { id: string; controller: AbortController } | null = null;
  private confirmation: AssistantState["confirmation"] = null;
  private decision?: (accepted: boolean) => void;
  private key = process.env.OPENAI_API_KEY || "";
  private model = process.env.OPENAI_MODEL || "gpt-6-astra";
  private name = process.env.OPENAI_CONNECTION_NAME || "OpenAI";
  private baseURL = process.env.OPENAI_BASE_URL || OPENAI_BASE_URL;
  private apiMode: "chat" | "responses" =
    process.env.OPENAI_API_MODE === "chat" ? "chat" : "responses";
  private keyStorage: AssistantState["keyStorage"] = this.key
    ? "environment"
    : "none";
  private writes = Promise.resolve();
  constructor(
    private bridge: EditorBridge,
    private data: string,
    private modelCall: (request: ModelRequest) => Promise<ModelReply> = respond,
    private fetcher: typeof fetch = fetch,
    private importFile: ToolContext["importFile"] = () =>
      Promise.reject(new Error("Importing files isn't available here.")),
  ) {}

  async load() {
    try {
      const stored = JSON.parse(
        await readFile(path.join(this.data, "assistant.json"), "utf8"),
      );
      if (Array.isArray(stored.messages))
        this.messages = stored.messages
          .slice(-60)
          .filter(
            (m: AssistantMessage) =>
              typeof m.id === "string" &&
              ["user", "assistant"].includes(m.role) &&
              typeof m.text === "string" &&
              Array.isArray(m.steps) &&
              Array.isArray(m.artifacts),
          )
          .map((m: AssistantMessage) => ({
            ...m,
            status: m.status === "running" ? "stopped" : m.status,
            steps: m.steps.map((s) =>
              s.status === "running"
                ? {
                    ...s,
                    status: "error",
                    detail:
                      "The app restarted. Check the editor before retrying.",
                  }
                : s,
            ),
            ...(m.status === "running"
              ? {
                  error:
                    "The app restarted. Completed edits are still in the project.",
                }
              : {}),
          }));
      const connection = ConnectionSchema.safeParse(stored);
      if (connection.success) {
        if (!process.env.OPENAI_MODEL) this.model = connection.data.model;
        if (!process.env.OPENAI_CONNECTION_NAME)
          this.name = connection.data.name;
        // Environment credentials use their environment endpoint, never a saved
        // endpoint from a different account.
        if (!process.env.OPENAI_API_KEY && !process.env.OPENAI_BASE_URL)
          this.baseURL = connection.data.baseURL;
        if (!process.env.OPENAI_API_MODE && !process.env.OPENAI_API_KEY)
          this.apiMode = connection.data.apiMode;
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT")
        console.warn("Assistant history could not be loaded.");
    }
  }
  /** Connection for asset analysis; the key stays inside the service. */
  analysisConnection() {
    return this.key
      ? {
          apiKey: this.key,
          baseURL: this.baseURL,
          model: this.model,
          apiMode: this.apiMode,
        }
      : null;
  }
  state(): AssistantState {
    return {
      messages: this.messages,
      active: this.active?.id ?? null,
      stopping: this.active?.controller.signal.aborted ?? false,
      configured: !!this.key,
      model: this.model,
      name: this.name,
      baseURL: this.baseURL,
      apiMode: this.apiMode,
      keyStorage: this.keyStorage,
      editorConnected: this.bridge.status().editorConnected,
      confirmation: this.confirmation,
    };
  }
  configure(input: unknown) {
    if (this.active)
      throw new Error(
        "Stop the current task before changing the model connection.",
      );
    const settings = SettingsSchema.parse(input);
    this.model = settings.model;
    this.name = settings.name ?? this.name;
    this.apiMode = settings.apiMode ?? this.apiMode;
    if (
      settings.baseURL &&
      settings.baseURL !== this.baseURL &&
      !settings.reuseKey
    ) {
      this.key = "";
      this.keyStorage = "none";
    }
    this.baseURL = settings.baseURL ?? this.baseURL;
    if (settings.apiKey) {
      this.key = settings.apiKey;
      this.keyStorage = settings.keyStorage;
    }
    this.persist();
    return this.state();
  }
  async listModels() {
    if (!this.key) throw new Error("Connect an API key first.");
    const response = await this.fetcher(this.baseURL + "/models", {
      headers: { Authorization: `Bearer ${this.key}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error(
        this.error(
          Object.assign(new Error("The proxy could not list models."), {
            status: response.status,
          }),
        ),
      );
    const value = z
      .object({ data: z.array(z.object({ id: z.string() })) })
      .parse(await response.json());
    return { models: [...new Set(value.data.map((m) => m.id))].sort() };
  }
  disconnect() {
    if (this.active)
      throw new Error("Stop the current task before disconnecting.");
    this.key = "";
    this.keyStorage = "none";
    return this.state();
  }
  clear() {
    if (this.active)
      throw new Error(
        "Stop the current task before starting a new conversation.",
      );
    this.messages = [];
    this.persist();
    return this.state();
  }
  start(input: unknown) {
    if (this.active)
      throw new Error(
        "The assistant is already working. Stop it before sending another request.",
      );
    if (!this.key)
      throw new Error(
        "Connect your model in Assistant settings to start editing.",
      );
    if (!this.bridge.status().editorConnected)
      throw new Error("Wait for the editor to reconnect, then try again.");
    const request = MessageSchema.parse(input);
    const id = randomUUID();
    this.active = { id, controller: new AbortController() };
    this.messages = this.messages.slice(-58);
    this.messages.push({
      id: randomUUID(),
      role: "user",
      text: request.text,
      status: "done",
      steps: [],
      artifacts: [],
    });
    const message: AssistantMessage = {
      id,
      role: "assistant",
      text: "",
      status: "running",
      steps: [],
      artifacts: [],
    };
    this.messages.push(message);
    this.persist();
    void this.run(request, message, this.active.controller);
    return this.state();
  }
  stop() {
    this.active?.controller.abort();
    this.decision?.(false);
    return this.state();
  }
  approve(id: string, accepted: boolean) {
    if (this.confirmation?.id !== id || !this.decision)
      throw new Error("This confirmation is no longer pending.");
    this.decision(accepted);
    return this.state();
  }
  private persist() {
    const content = JSON.stringify({
      model: this.model,
      name: this.name,
      baseURL: this.baseURL,
      apiMode: this.apiMode,
      messages: this.messages,
    });
    this.writes = this.writes
      .catch(() => {})
      .then(async () => {
        const temp = path.join(this.data, "assistant.json.tmp");
        await writeFile(temp, content, { mode: 0o600 });
        await rename(temp, path.join(this.data, "assistant.json"));
      })
      .catch(() => console.warn("Assistant history could not be saved."));
  }
  async flush() {
    await this.writes;
  }
  private async local(route: string, signal: AbortSignal) {
    signal.throwIfAborted();
    const response = await this.fetcher(serviceOrigin + route, {
      signal,
    });
    const value = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        value.error || "The editor service could not complete this operation.",
      );
    return value;
  }
  private async localPost(route: string, body: unknown, signal: AbortSignal) {
    signal.throwIfAborted();
    const response = await this.fetcher(serviceOrigin + route, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-KamiKami": "assistant",
      },
      body: JSON.stringify(body),
      signal,
    });
    const value = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        value.error || "The editor service could not complete this operation.",
      );
    return value;
  }
  private async confirm(description: string, signal: AbortSignal) {
    signal.throwIfAborted();
    this.confirmation = { id: randomUUID(), description };
    return new Promise<boolean>((resolve) => {
      const abort = () => this.decision?.(false);
      signal.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(() => this.decision?.(false), 5 * 60 * 1000);
      this.decision = (value) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        resolve(value);
      };
    }).finally(() => {
      this.confirmation = null;
      this.decision = undefined;
    });
  }
  private async run(
    request: z.infer<typeof MessageSchema>,
    message: AssistantMessage,
    controller: AbortController,
  ) {
    const signal = controller.signal;
    const session = this.bridge.connect("KamiKami Assistant", "1");
    const heartbeat = setInterval(
      () => this.bridge.heartbeat(session.id),
      4000,
    );
    const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000);
    const command = (action: string, args: Record<string, unknown> = {}) =>
      this.bridge.request(
        session.id,
        { ...args, action },
        {
          nativeAssistant: true,
          historyGroup: `assistant:${message.id}`,
          signal,
        },
      );
    try {
      const snapshot = (await command("get_project")) as Snapshot;
      const selected = snapshot.project.layers.filter((l) =>
        request.selectedLayerIds.includes(l.id),
      );
      this.messages.at(-2)!.context =
        `${selected.length ? selected.map((l) => l.name).join(", ") : "Whole composition"} · ${(request.frame / snapshot.project.fps).toFixed(2)}s`;
      const input: ResponseInputItem[] = this.messages
        .slice(0, -1)
        .slice(-20)
        .map((m) => ({
          role: m.role,
          content:
            m.text +
            (m.role === "assistant"
              ? `\nTask status: ${m.status}. ${m.error ?? ""}\nActions: ${m.steps.map((s) => `${s.label}: ${s.status}`).join("; ")}`
              : ""),
        }));
      // One line per asset so the model knows the footage without reading it.
      const digest = (await this.local("/api/analysis/digest", signal).catch(
        () => null,
      )) as { digest?: string } | null;
      input.push({
        role: "user",
        content: `Current editor context (data): ${JSON.stringify({
          ...snapshot,
          selectedLayerIds: selected.map((l) => l.id),
          frame: request.frame,
          attachedMedia: request.attachments,
        })}${digest?.digest ? `\n\nMedia library (analysis digest; use get_asset_analysis/search_assets for detail):\n${digest.digest}` : ""}`,
      });
      for (let round = 0; round < 30; round++) {
        signal.throwIfAborted();
        if (message.text) message.text += "\n\n";
        const reply = await this.modelCall({
          apiKey: this.key,
          model: this.model,
          name: this.name,
          baseURL: this.baseURL,
          apiMode: this.apiMode,
          input,
          tools: assistantTools,
          instructions,
          signal,
          onText: (text) => {
            message.text += text;
          },
        });
        signal.throwIfAborted();
        input.push(...reply.items);
        if (!reply.calls.length) {
          if (!message.text.trim())
            throw new Error(
              "The model returned no answer. Try again with a smaller request.",
            );
          message.status = "done";
          return;
        }
        for (const call of reply.calls) {
          signal.throwIfAborted();
          if (message.steps.length >= 60)
            throw new Error(
              "This task reached its action limit. Completed edits are preserved; ask me to continue.",
            );
          const step: AssistantStep = {
            id: randomUUID(),
            label: labels[call.name] ?? "Checking an action",
            status: "running",
          };
          message.steps.push(step);
          let output: unknown;
          let preview: ResponseInputItem | undefined;
          try {
            const run = await runTool(
              call.name,
              JSON.parse(call.arguments || "{}"),
              {
                command,
                get: (route) => this.local(route, signal),
                post: (route, body) => this.localPost(route, body, signal),
                importFile: this.importFile,
                confirm: (question) => this.confirm(question, signal),
                by: "assistant",
                signal,
              },
            );
            output = run.result;
            if (run.image) {
              const response = await this.fetcher(
                serviceOrigin + run.image.url,
                { signal },
              );
              if (!response.ok) throw new Error("The image is unavailable.");
              const data = Buffer.from(await response.arrayBuffer()).toString(
                "base64",
              );
              preview = {
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: `${run.image.caption}, from ${call.name} (tool image data).`,
                  },
                  {
                    type: "input_image",
                    image_url: `data:image/png;base64,${data}`,
                    detail: "auto",
                  },
                ],
              };
              if (!message.artifacts.some((a) => a.url === run.image!.url))
                message.artifacts.push({
                  kind: "image",
                  label: run.image.label,
                  url: run.image.url,
                });
            }
            const result = output as { status?: string; id?: string };
            if (
              call.name === "get_export" &&
              result.status === "done" &&
              result.id
            )
              message.artifacts.push({
                kind: "video",
                label: "Download video",
                url: `/api/exports/${encodeURIComponent(result.id)}.mp4`,
              });
            if (call.name === "export_effect_bundle")
              message.artifacts.push({
                kind: "effect",
                label: "Download effect",
                bundle: output,
              });
            step.status = "done";
          } catch (e) {
            step.status = "error";
            step.detail = this.error(e);
            if (signal.aborted) throw e;
            output = { error: step.detail };
          }
          input.push({
            type: "function_call_output",
            call_id: call.id,
            output: JSON.stringify(output),
          });
          if (preview) input.push(preview);
          this.persist();
        }
      }
      throw new Error(
        "This task reached its conversation limit. Completed edits are preserved; ask me to continue.",
      );
    } catch (e) {
      message.status = signal.aborted ? "stopped" : "error";
      message.error = signal.aborted
        ? "Stopped. Completed edits remain in the editor."
        : this.error(e);
    } finally {
      clearInterval(heartbeat);
      clearTimeout(timeout);
      this.bridge.disconnect(session.id);
      this.active = null;
      this.confirmation = null;
      this.decision = undefined;
      this.persist();
    }
  }
  private error(e: unknown) {
    const status = (e as { status?: number })?.status;
    if (status === 401)
      return "The API key was rejected. Update it in Assistant settings.";
    if (status === 429)
      return "The model account has reached a usage or rate limit. Check its billing or try again later.";
    if (status === 404)
      return "This model is unavailable for your account. Choose another model in Assistant settings.";
    if (status && status >= 500)
      return "The model service is temporarily unavailable. Try again shortly.";
    return (e instanceof Error ? toolError(e) : "Something went wrong.")
      .replaceAll(this.key || "\u0000", "[redacted]")
      .slice(0, 800);
  }
}
