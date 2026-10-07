import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import type { Project } from "../src/model";
const client = new Client({
  name: "KamiKami MCP verification",
  version: "1.0.0",
});
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [fileURLToPath(new URL("../server/mcp.mjs", import.meta.url))],
  stderr: "pipe",
});
type Snapshot = {
  project: Project;
  revision: string;
  frame: number;
  selectedLayerIds: string[];
  saved: boolean;
  editing: boolean;
};
async function call(name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as { type: string; text?: string }[];
  const text = content.find((c) => c.type === "text")?.text ?? "";
  if (result.isError) throw new Error(text);
  return JSON.parse(text);
}
let before: Snapshot | undefined,
  last: Snapshot | undefined,
  edits = 0;
try {
  await client.connect(transport);
  const tools = await client.listTools();
  assert.ok(tools.tools.some((t) => t.name === "update_layer"));
  const resource = await client.readResource({
    uri: "kamikami://editing-skill",
  });
  assert.ok(resource.contents.length);
  before = await call("get_project");
  assert.equal(
    before!.editing,
    false,
    "Finish the active field/gesture before running this test.",
  );
  last = before;
  const media = await call("get_media_library");
  assert.ok(Array.isArray(media));
  last = await call("add_text", {
    text: "MCP verification",
    name: "MCP test title",
    duration: 3,
    expectedRevision: last!.revision,
  });
  edits++;
  const id = last!.project.layers.at(-1)!.id;
  assert.equal(last!.project.layers.length, before!.project.layers.length + 1);
  const stale = await client.callTool({
    name: "update_layer",
    arguments: {
      layerId: id,
      patch: { x: 99 },
      expectedRevision: before!.revision,
    },
  });
  assert.equal(stale.isError, true);
  last = await call("update_layer", {
    layerId: id,
    patch: { x: 100, y: -100, color: "#F2765E" },
    expectedRevision: last!.revision,
  });
  edits++;
  assert.equal(last!.project.layers.at(-1)!.x, 100);
  last = await call("reorder_layers", {
    layerIds: [id, ...before!.project.layers.map((l) => l.id)],
    expectedRevision: last!.revision,
  });
  edits++;
  assert.equal(last!.project.layers[0].id, id);
  const edited = structuredClone(last!.project);
  edited.effects.push({
    id: "mcp-test-effect",
    name: "MCP fade",
    description: "Test only",
    color: "#F2765E",
    tint: 0,
    channels: [
      {
        property: "opacity",
        curve: "linear",
        from: 0,
        to: 1,
        frequency: 1,
        phase: 0,
      },
    ],
  });
  edited.layers[0].effects = [
    { effectId: "mcp-test-effect", amount: 1, enabled: true },
  ];
  last = await call("apply_project", {
    project: edited,
    expectedRevision: last!.revision,
  });
  edits++;
  await call("select_layers", { layerIds: [id] });
  await call("set_playhead", { frame: 24 });
  last = await call("save_project");
  assert.equal(last!.saved, true);
  assert.equal((await call("get_project")).frame, 24);
  const status = await (await fetch("http://127.0.0.1:4318/api/agents")).json();
  assert.ok(
    status.clients.some(
      (c: { name: string }) => c.name === "KamiKami MCP verification",
    ),
  );
  console.log(
    "MCP connected: discovery, skill resource, live read, text/edit/effect/reorder/select/seek/save and stale-revision rejection passed.",
  );
  if (process.argv.includes("--hold"))
    await new Promise((r) => setTimeout(r, 20000));
  last = await call("undo", { expectedRevision: last!.revision });
  edits--;
  last = await call("redo", { expectedRevision: last!.revision });
  edits++;
} finally {
  try {
    if (before && last && edits) {
      const live: Snapshot = await call("get_project");
      if (live.revision !== last.revision)
        throw new Error(
          "Project changed during test. Refusing to overwrite intervening changes.",
        );
      while (edits-- > 0)
        last = await call("undo", { expectedRevision: last!.revision });
      assert.deepEqual(last!.project, before.project);
      await call("select_layers", { layerIds: before.selectedLayerIds });
      await call("set_playhead", { frame: before.frame });
      await call("save_project");
      console.log(
        "Undo/redo verified; original composition restored and saved.",
      );
    }
  } finally {
    await client.close();
  }
}
