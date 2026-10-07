import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { AssistantService, assistantTools } from "../server/assistant";
import type { ModelRequest, ModelReply } from "../server/assistant-model";
import { definitions } from "../server/editor-tools.mjs";
import { EditorBridge } from "../server/editor-bridge";
import { applyAgentEdit, type EditorRequest } from "../src/agent-protocol";
import { initialProject } from "../src/model";
import { EditHistory } from "../src/history";

async function until(condition: () => boolean) {
  const deadline = Date.now() + 3000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("Test timed out");
    await delay(5);
  }
}
function call(name: string, args: unknown): ModelReply {
  const id = crypto.randomUUID();
  return {
    items: [
      {
        type: "function_call",
        call_id: id,
        name,
        arguments: JSON.stringify(args),
      },
    ],
    calls: [{ id, name, arguments: JSON.stringify(args) }],
  };
}
function done(request: ModelRequest, text = "The edit is ready."): ModelReply {
  request.onText(text);
  return { items: [{ role: "assistant", content: text }], calls: [] };
}
async function harness(
  model: (r: ModelRequest) => Promise<ModelReply>,
  fetcher?: typeof fetch,
) {
  const data = await mkdtemp(path.join(tmpdir(), "kamikami-assistant-test-"));
  const bridge = new EditorBridge();
  let project = structuredClone(initialProject),
    revision = 0;
  const history = new EditHistory<typeof project>();
  const requests: EditorRequest[] = [];
  const snapshot = () => ({
    project: structuredClone(project),
    revision: `editor:${revision}`,
    selectedLayerIds: ["title"],
    frame: 24,
  });
  const handle = (request: EditorRequest) => {
    requests.push(request);
    try {
      const c = request.command;
      if ("expectedRevision" in c && c.expectedRevision !== snapshot().revision)
        throw new Error("Project changed. Read it again.");
      if (c.action !== "get_project") {
        if (c.action === "get_media_library") {
          bridge.reply("editor", request.id, []);
          return;
        }
        if (c.action === "undo") {
          project = history.undo(project)!;
          revision++;
        } else {
          const next = applyAgentEdit(project, c, []);
          history.record(project, request.historyGroup);
          project = next;
          revision++;
        }
      }
      bridge.reply("editor", request.id, snapshot());
    } catch (e) {
      bridge.reply("editor", request.id, undefined, (e as Error).message);
    }
  };
  bridge.poll("editor");
  const timer = setInterval(() => {
    for (const request of bridge.poll("editor").requests) handle(request);
  }, 3);
  const service = new AssistantService(bridge, data, model, fetcher);
  service.configure({
    model: "test-model",
    apiKey: "test-secret-do-not-persist",
  });
  return {
    service,
    bridge,
    history,
    requests,
    snapshot,
    data,
    start: (text = "Animate this title") =>
      service.start({ text, selectedLayerIds: ["title"], frame: 24 }),
    manual: () => {
      history.record(project);
      project = { ...project, name: "Manual change" };
      revision++;
    },
    cleanup: async () => {
      service.stop();
      await until(() => !service.state().active);
      clearInterval(timer);
      await service.flush();
      await rm(data, { recursive: true, force: true });
    },
  };
}
function latest(request: ModelRequest) {
  const output = request.input
    .slice()
    .reverse()
    .find((i) => i.type === "function_call_output");
  return output && "output" in output
    ? JSON.parse(output.output as string)
    : undefined;
}

test("native tools share the MCP catalog; file access is supplied by the attachment chooser", () => {
  assert.deepEqual(
    assistantTools.map((t) => t.name),
    definitions.filter((d) => d[0] !== "import_media").map((d) => d[0]),
  );
  assert.equal(assistantTools.length, 36);
});

test("multi-step native edits use live revisions and one undo group, and history excludes credentials", async () => {
  let round = 0;
  const h = await harness(async (r) => {
    assert.equal(r.signal.aborted, false);
    if (round++ === 0) {
      const context = JSON.stringify(r.input);
      assert.match(context, /selectedLayerIds/);
      assert.match(context, /Current editor context/);
      return call("add_text", {
        text: "Native assistant title",
        expectedRevision: "editor:0",
      });
    }
    if (round === 2) {
      const state = latest(r);
      return call("update_layer", {
        layerId: state.project.layers.at(-1).id,
        patch: { x: 123 },
        expectedRevision: state.revision,
      });
    }
    assert.equal(latest(r).project.layers.at(-1).x, 123);
    return done(r, "Added and positioned your title.");
  });
  try {
    const turn = h.start().active!;
    assert.throws(() => h.start(), /already working/);
    assert.throws(() => h.service.clear(), /Stop the current/);
    await until(() => !h.service.state().active);
    assert.equal(h.service.state().messages.at(-1)?.status, "done");
    assert.equal(h.snapshot().project.layers.at(-1)?.x, 123);
    assert.ok(h.requests.every((r) => r.nativeAssistant));
    assert.equal(h.history.latestGroup, `assistant:${turn}`);
    assert.deepEqual(h.history.undo(h.snapshot().project), initialProject);
    assert.equal(h.history.canUndo, false);
    await h.service.flush();
    const stored = await readFile(path.join(h.data, "assistant.json"), "utf8");
    assert.ok(!stored.includes("test-secret"));
    assert.ok(!JSON.stringify(h.service.state()).includes("test-secret"));
    const restored = new AssistantService(h.bridge, h.data);
    await restored.load();
    assert.equal(
      restored.state().messages.at(-1)?.text,
      "Added and positioned your title.",
    );
  } finally {
    await h.cleanup();
  }
});

test("manual changes break assistant undo groups and stale revisions cannot overwrite them", async () => {
  let round = 0;
  const h = await harness(async (r) => {
    if (round++ === 0)
      return call("add_text", {
        text: "First change",
        expectedRevision: "editor:0",
      });
    if (round === 2) {
      h.manual();
      return call("add_text", {
        text: "Stale change",
        expectedRevision: latest(r).revision,
      });
    }
    assert.match(latest(r).error, /Project changed/);
    return done(r, "The project changed; I preserved your manual edit.");
  });
  try {
    h.start();
    await until(() => !h.service.state().active);
    assert.equal(h.snapshot().project.name, "Manual change");
    assert.equal(
      h.snapshot().project.layers.length,
      initialProject.layers.length + 1,
    );
    assert.equal(h.history.latestGroup, undefined);
    assert.equal(
      h.service.state().messages.at(-1)?.steps.at(-1)?.status,
      "error",
    );
  } finally {
    await h.cleanup();
  }
});

test("destructive changes wait for approval and a declined edit does not touch the project", async () => {
  let round = 0;
  const h = await harness(async (r) =>
    round++ === 0
      ? call("delete_layers", {
          layerIds: [initialProject.layers[0].id],
          expectedRevision: "editor:0",
        })
      : (assert.match(latest(r).error, /declined/), done(r, "Kept your clip.")),
  );
  try {
    h.start();
    await until(() => !!h.service.state().confirmation);
    assert.deepEqual(h.snapshot().project, initialProject);
    const confirmation = h.service.state().confirmation!;
    h.service.approve(confirmation.id, false);
    await until(() => !h.service.state().active);
    assert.deepEqual(h.snapshot().project, initialProject);
    assert.equal(h.service.state().confirmation, null);
  } finally {
    await h.cleanup();
  }
});

test("approved deletion applies through the live bridge and remains undoable", async () => {
  let round = 0;
  const h = await harness(async (r) =>
    round++ === 0
      ? call("delete_layers", {
          layerIds: [initialProject.layers[0].id],
          expectedRevision: "editor:0",
        })
      : done(r, "Removed the clip."),
  );
  try {
    h.start();
    await until(() => !!h.service.state().confirmation);
    h.service.approve(h.service.state().confirmation!.id, true);
    await until(() => !h.service.state().active);
    assert.equal(
      h.snapshot().project.layers.length,
      initialProject.layers.length - 1,
    );
    assert.deepEqual(h.history.undo(h.snapshot().project), initialProject);
  } finally {
    await h.cleanup();
  }
});

test("cancellation interrupts model work, preserves completed edits and cannot execute later calls", async () => {
  let round = 0,
    generating = false;
  const h = await harness(async (r) => {
    if (round++ === 0)
      return call("add_text", {
        text: "Keep this completed edit",
        expectedRevision: "editor:0",
      });
    generating = true;
    await delay(5000, undefined, { signal: r.signal });
    return call("delete_layers", {
      layerIds: [initialProject.layers[0].id],
      expectedRevision: "editor:1",
    });
  });
  try {
    h.start();
    await until(() => generating);
    h.service.stop();
    await until(() => !h.service.state().active);
    assert.equal(h.service.state().messages.at(-1)?.status, "stopped");
    assert.equal(
      h.snapshot().project.layers.length,
      initialProject.layers.length + 1,
    );
    assert.equal(
      h.requests.some((r) => r.command.action === "delete_layers"),
      false,
    );
  } finally {
    await h.cleanup();
  }
});

test("stopping a pending confirmation releases the task without deleting clips", async () => {
  const h = await harness(async () =>
    call("delete_layers", {
      layerIds: [initialProject.layers[0].id],
      expectedRevision: "editor:0",
    }),
  );
  try {
    h.start();
    await until(() => !!h.service.state().confirmation);
    h.service.stop();
    await until(() => !h.service.state().active);
    assert.equal(h.service.state().confirmation, null);
    assert.deepEqual(h.snapshot().project, initialProject);
  } finally {
    await h.cleanup();
  }
});

test("unknown tools and invalid editor parameters cannot mutate the project", async () => {
  let round = 0;
  const h = await harness(async (r) => {
    if (round++ === 0) return call("read_any_file", { path: "/private/data" });
    if (round === 2) {
      assert.match(latest(r).error, /not available/);
      return call("update_layer", {
        layerId: initialProject.layers[0].id,
        patch: { x: 999999 },
        expectedRevision: "editor:0",
      });
    }
    assert.ok(latest(r).error);
    return done(r, "That edit is outside the allowed range.");
  });
  try {
    h.start();
    await until(() => !h.service.state().active);
    assert.deepEqual(h.snapshot().project, initialProject);
    assert.equal(
      h.service
        .state()
        .messages.at(-1)
        ?.steps.filter((s) => s.status === "error").length,
      2,
    );
  } finally {
    await h.cleanup();
  }
});

test("model authentication failure has an actionable error and no fabricated completion", async () => {
  const h = await harness(async () => {
    throw Object.assign(new Error("private provider error"), { status: 401 });
  });
  try {
    h.start();
    await until(() => !h.service.state().active);
    const message = h.service.state().messages.at(-1)!;
    assert.equal(message.status, "error");
    assert.match(message.error!, /API key was rejected/);
    assert.equal(message.text, "");
    assert.deepEqual(h.snapshot().project, initialProject);
    h.service.disconnect();
    assert.equal(h.service.state().configured, false);
    assert.throws(() => h.start(), /Connect your model/);
  } finally {
    await h.cleanup();
  }
});

test("rendered images reach the conversation and model without persisting image payloads", async () => {
  let round = 0;
  const h = await harness(
    async (r) => {
      if (round++ === 0) return call("get_render", { jobId: "test-render" });
      const serialized = JSON.stringify(r.input);
      assert.match(serialized, /data:image\/png;base64/);
      assert.match(serialized, /function_call_output/);
      return done(r, "I inspected the rendered frame.");
    },
    async (url) =>
      new Response(
        String(url).includes("/api/renders/")
          ? new Uint8Array([1, 2, 3])
          : JSON.stringify({ id: "test-render", status: "done", frame: 24 }),
        { status: 200 },
      ),
  );
  try {
    h.start();
    await until(() => !h.service.state().active);
    assert.equal(h.service.state().messages.at(-1)?.artifacts[0].kind, "image");
    await h.service.flush();
    assert.ok(
      !(await readFile(path.join(h.data, "assistant.json"), "utf8")).includes(
        "data:image",
      ),
    );
  } finally {
    await h.cleanup();
  }
});

test("restart marks interrupted conversations stopped", async () => {
  const h = await harness(async (r) => done(r));
  try {
    await h.service.flush();
    await writeFile(
      path.join(h.data, "assistant.json"),
      JSON.stringify({
        messages: [
          {
            id: "interrupted",
            role: "assistant",
            text: "Working",
            status: "running",
            artifacts: [],
            steps: [{ id: "step", label: "Editing", status: "running" }],
          },
        ],
      }),
    );
    await h.service.load();
    const message = h.service.state().messages[0];
    assert.equal(message.status, "stopped");
    assert.equal(message.steps[0].status, "error");
    assert.match(message.error!, /restarted/);
  } finally {
    await h.cleanup();
  }
});

test("bridge cancels an undelivered native edit and waits for an in-flight edit to settle", async () => {
  const bridge = new EditorBridge(),
    session = bridge.connect("native", "1");
  bridge.poll("editor");
  const first = new AbortController();
  const queued = bridge.request(
    session.id,
    { action: "get_project" },
    { signal: first.signal, nativeAssistant: true },
  );
  first.abort();
  await assert.rejects(queued, /stopped/);
  assert.equal(bridge.poll("editor").requests.length, 0);
  const second = new AbortController();
  const delivered = bridge.request(
    session.id,
    { action: "get_project" },
    { signal: second.signal, historyGroup: "native-task" },
  );
  const request = bridge.poll("editor").requests[0];
  second.abort();
  assert.equal(request.historyGroup, "native-task");
  bridge.reply("editor", request.id, { applied: true });
  assert.deepEqual(await delivered, { applied: true });
});

test("proxy connection fields persist, aliases allow spaces/slashes, and changing endpoints clears credentials", async () => {
  const h = await harness(async (r) => {
    assert.equal(r.baseURL, "https://proxy.example/v1");
    assert.equal(r.apiMode, "chat");
    assert.equal(r.model, "azure/my deployment");
    return done(r);
  });
  try {
    h.service.configure({
      name: "Azure OpenAI",
      baseURL: "https://proxy.example/v1/",
      apiMode: "chat",
      model: "azure/my deployment",
    });
    assert.equal(h.service.state().configured, false);
    h.service.configure({
      model: "azure/my deployment",
      apiKey: "proxy-secret",
    });
    h.start();
    await until(() => !h.service.state().active);
    assert.equal(h.service.state().messages.at(-1)?.status, "done");
    await h.service.flush();
    const restored = new AssistantService(h.bridge, h.data);
    await restored.load();
    assert.equal(restored.state().name, "Azure OpenAI");
    assert.equal(restored.state().baseURL, "https://proxy.example/v1");
    assert.equal(restored.state().apiMode, "chat");
    assert.equal(restored.state().configured, false);
    assert.ok(
      !(await readFile(path.join(h.data, "assistant.json"), "utf8")).includes(
        "proxy-secret",
      ),
    );
    assert.throws(() =>
      h.service.configure({
        model: "test",
        baseURL: "https://key:secret@proxy.example/v1",
      }),
    );
    assert.throws(() =>
      h.service.configure({
        model: "test",
        baseURL: "https://proxy.example/v1?api_key=secret",
      }),
    );
    assert.throws(() =>
      h.service.configure({
        model: "test",
        baseURL: "http://remote.example/v1",
      }),
    );
    assert.doesNotThrow(() =>
      h.service.configure({
        model: "test",
        baseURL: "http://localhost:4000/v1",
      }),
    );
  } finally {
    await h.cleanup();
  }
});

test("explicit key reuse preserves credentials for a user-chosen endpoint and models load from it", async () => {
  let fetched = "";
  const h = await harness(
    async (r) => done(r),
    async (url, init) => {
      fetched = String(url);
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        "Bearer test-secret-do-not-persist",
      );
      return new Response(
        JSON.stringify({
          data: [
            { id: "azure/model-a" },
            { id: "azure/model-a" },
            { id: "model-b" },
          ],
        }),
        { status: 200 },
      );
    },
  );
  try {
    h.service.configure({
      name: "Proxy",
      baseURL: "https://proxy.example/v1",
      apiMode: "chat",
      model: "azure/model-a",
      reuseKey: true,
    });
    assert.equal(h.service.state().configured, true);
    assert.deepEqual(await h.service.listModels(), {
      models: ["azure/model-a", "model-b"],
    });
    assert.equal(fetched, "https://proxy.example/v1/models");
  } finally {
    await h.cleanup();
  }
});
