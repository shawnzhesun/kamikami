import { randomUUID } from "node:crypto";
import { AgentCommandSchema, type EditorRequest } from "../src/agent-protocol";
export class EditorBridge {
  private agents = new Map<
    string,
    {
      id: string;
      name: string;
      version: string;
      connectedAt: number;
      lastSeen: number;
    }
  >();
  private editor: { id: string; lastSeen: number } | null = null;
  private requests = new Map<
    string,
    {
      request: EditorRequest;
      editorId: string;
      delivered: boolean;
      resolve: (v: unknown) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  constructor(
    private now = () => Date.now(),
    private timeout = 30000,
  ) {}
  connect(name: string, version: string) {
    const id = randomUUID();
    this.agents.set(id, {
      id,
      name: name.slice(0, 100),
      version: version.slice(0, 40),
      connectedAt: this.now(),
      lastSeen: this.now(),
    });
    return { id };
  }
  heartbeat(id: string) {
    const agent = this.agents.get(id);
    if (!agent)
      throw new Error("Agent connection expired. Reconnect the MCP server.");
    agent.lastSeen = this.now();
  }
  disconnect(id: string) {
    this.agents.delete(id);
    for (const [key, p] of this.requests)
      if (p.request.id.startsWith(id + ":")) {
        clearTimeout(p.timer);
        p.reject(
          new Error(
            "Agent disconnected. Read the project before retrying an edit.",
          ),
        );
        this.requests.delete(key);
      }
  }
  status() {
    for (const [id, a] of this.agents)
      if (this.now() - a.lastSeen > 15000) this.disconnect(id);
    return {
      editorConnected:
        !!this.editor && this.now() - this.editor.lastSeen < 5000,
      clients: [...this.agents.values()],
    };
  }
  poll(editorId: string) {
    if (
      this.editor &&
      this.editor.id !== editorId &&
      this.now() - this.editor.lastSeen < 5000
    )
      return { primary: false, requests: [] };
    this.editor = { id: editorId, lastSeen: this.now() };
    const requests: EditorRequest[] = [];
    for (const p of this.requests.values())
      if (!p.delivered && p.editorId === editorId) {
        p.delivered = true;
        requests.push(p.request);
      }
    return { primary: true, requests };
  }
  request(
    agentId: string,
    input: unknown,
    options: {
      historyGroup?: string;
      nativeAssistant?: boolean;
      signal?: AbortSignal;
    } = {},
  ): Promise<unknown> {
    options.signal?.throwIfAborted();
    this.heartbeat(agentId);
    const command = AgentCommandSchema.parse(input);
    if (!this.status().editorConnected)
      return Promise.reject(
        new Error("Open KamiKami and wait for the editor session to connect."),
      );
    if (this.requests.size >= 20)
      return Promise.reject(
        new Error("Editor queue is full. Wait for the current operation."),
      );
    const request: EditorRequest = {
      id: agentId + ":" + randomUUID(),
      clientName: this.agents.get(agentId)!.name,
      command,
      expiresAt: this.now() + this.timeout,
      historyGroup: options.historyGroup,
      nativeAssistant: options.nativeAssistant,
    };
    let abort: (() => void) | undefined;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.requests.delete(request.id);
        reject(
          new Error(
            "Editor did not acknowledge the operation. Read the project before retrying; an edit may have completed.",
          ),
        );
      }, this.timeout);
      this.requests.set(request.id, {
        request,
        editorId: this.editor!.id,
        delivered: false,
        resolve,
        reject,
        timer,
      });
      abort = () => {
        const pending = this.requests.get(request.id);
        // A delivered operation must settle before reporting cancellation; it
        // may already be committing in the renderer.
        if (pending && !pending.delivered) {
          clearTimeout(timer);
          this.requests.delete(request.id);
          reject(new Error("Assistant stopped before this edit started."));
        }
      };
      options.signal?.addEventListener("abort", abort, { once: true });
    }).finally(() => {
      if (abort) options.signal?.removeEventListener("abort", abort);
    });
  }
  reply(editorId: string, id: string, result: unknown, error?: string) {
    const p = this.requests.get(id);
    if (!p) return false;
    if (p.editorId !== editorId || !p.delivered)
      throw new Error("Reply does not belong to this editor session.");
    clearTimeout(p.timer);
    this.requests.delete(id);
    if (error) p.reject(new Error(error));
    else p.resolve(result);
    return true;
  }
}
