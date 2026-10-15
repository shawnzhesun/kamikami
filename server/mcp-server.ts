import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { editorTools } from "./editor-tools";
import { mcpInstructions } from "./agent-conventions";
import type { ToolOutput } from "./tool-runner";
import { serviceOrigin } from "./service-config";

/**
 * A thin stdio proxy: every tool runs in the KamiKami service through the
 * dispatcher the native assistant uses (server/tool-runner.ts).
 */
const base = serviceOrigin;
async function api<T>(route: string, body?: unknown, timeoutMs = 45_000) {
  const response = await fetch(base + route, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", "X-KamiKami": "mcp" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error || "KamiKami request failed");
  return value as T;
}
const server = new McpServer(
  { name: "kamikami", version: "0.4.0" },
  { instructions: mcpInstructions },
);
// The installed app's launcher (electron/bin) names the app executable, so the
// first tool call can open KamiKami instead of failing until the user does.
const appExecutable = process.env.KAMIKAMI_APP ?? "";
let launching: Promise<void> | null = null;
async function editorReady() {
  try {
    return (
      await api<{ editorConnected: boolean }>("/api/agents", undefined, 2000)
    ).editorConnected;
  } catch {
    return false;
  }
}
async function launchApp() {
  if (!appExecutable || (await editorReady())) return;
  launching ??= (async () => {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    // On macOS, LaunchServices reuses a running instance and keeps Dock behavior.
    // It doesn't inherit our environment, so pass on the port and workspace
    // overrides this client was configured with.
    const bundle = /^(.*\.app)\/Contents\/MacOS\//.exec(appExecutable)?.[1];
    const overrides = Object.entries(env)
      .filter(
        ([name]) => name.startsWith("KAMIKAMI_") && name !== "KAMIKAMI_APP",
      )
      .flatMap(([name, value]) => ["--env", `${name}=${value}`]);
    spawn(
      bundle ? "open" : appExecutable,
      bundle ? [...overrides, "-a", bundle] : [],
      { detached: true, stdio: "ignore", env },
    ).unref();
    for (let i = 0; i < 120; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (await editorReady()) return;
    }
    throw new Error("KamiKami did not start. Open the app and try again.");
  })().finally(() => (launching = null));
  return launching;
}
let session: { id: string } | null = null;
let connecting: Promise<{ id: string }> | null = null;
let heartbeat: ReturnType<typeof setInterval> | undefined;
/** Only tool calls launch the app; starting a client session or a heartbeat never does. */
async function connect(launch = false): Promise<{ id: string }> {
  if (session) return session;
  if (connecting) {
    // The first tool call can arrive while the startup attempt, which never
    // launches, is still in flight; if that fails, retry with a launch.
    if (!launch) return connecting;
    return connecting.catch(() => connect(true));
  }
  connecting = (async () => {
    if (launch) await launchApp();
    const client = server.server.getClientVersion();
    session = await api<{ id: string }>("/api/agents/connect", {
      name: client?.name || "MCP client",
      version: client?.version || "",
    });
    return session;
  })().finally(() => (connecting = null));
  return connecting;
}
server.server.oninitialized = () => {
  void connect().catch((e) => console.error("KamiKami:", e.message));
  heartbeat = setInterval(() => {
    void connect()
      .then((s) => api("/api/agents/heartbeat", { id: s.id }))
      .catch(() => (session = null));
  }, 4000);
  heartbeat.unref();
};
// Long enough for a 30 s timeline render, a polled frame render or a large import.
const timeouts: Record<string, number> = {
  import_media: 30 * 60_000,
  view_timeline_range: 200_000,
  render_frame: 130_000,
  set_asset_metadata: 200_000,
};
async function call(name: string, args: unknown) {
  try {
    const { id } = await connect(true);
    const { result, image } = await api<ToolOutput>(
      "/api/agents/tool",
      { id, name, args },
      timeouts[name] ?? 60_000,
    );
    const content: (
      | { type: "text"; text: string }
      | { type: "image"; mimeType: string; data: string }
    )[] = [{ type: "text", text: JSON.stringify(result) }];
    if (image) {
      const response = await fetch(base + image.url);
      if (!response.ok) throw new Error("The image is unavailable.");
      content.push({
        type: "image",
        mimeType: "image/png",
        data: Buffer.from(await response.arrayBuffer()).toString("base64"),
      });
    }
    return { content };
  } catch (e) {
    // A dropped session or a closed app reconnects (and relaunches) on the next call.
    if (/expired|Reconnect|fetch failed/.test((e as Error).message))
      session = null;
    return {
      isError: true,
      content: [{ type: "text" as const, text: (e as Error).message }],
    };
  }
}
for (const { name, description, input, access } of editorTools)
  server.registerTool(
    name,
    {
      description,
      inputSchema: input,
      annotations: {
        readOnlyHint: access === "read",
        destructiveHint: access === "edit",
        openWorldHint: false,
      },
    },
    (args: unknown) => call(name, args),
  );
server.registerResource(
  "editing-skill",
  "kamikami://editing-skill",
  {
    mimeType: "text/markdown",
    description: "KamiKami editing workflow",
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "text/markdown",
        text: await readFile(
          new URL(
            "../.agents/skills/kamikami-editor/SKILL.md",
            import.meta.url,
          ),
          "utf8",
        ),
      },
    ],
  }),
);
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  clearInterval(heartbeat);
  if (session)
    await api("/api/agents/disconnect", { id: session.id }).catch(() => {});
  await server.close();
}
process.on("SIGTERM", () => void close().finally(() => process.exit(0)));
process.on("SIGINT", () => void close().finally(() => process.exit(0)));
process.stdin.on("end", () => void close());
await server.connect(new StdioServerTransport());
