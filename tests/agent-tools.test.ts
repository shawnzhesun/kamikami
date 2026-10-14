import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { editorTools } from "../server/editor-tools";
import { AgentCommandSchema } from "../src/agent-protocol";
import { agentConventions, mcpInstructions } from "../server/agent-conventions";
import { LIMITS } from "../src/model";
import { runTool } from "../server/tool-runner";

/** Tools the service answers itself instead of the editor. */
const serviceTools = new Set([
  "get_capabilities",
  "find_effects",
  "describe_effect",
  "get_asset_analysis",
  "search_assets",
  "set_asset_metadata",
  "analyze_assets",
  "view_asset_range",
  "view_timeline_range",
  "import_media",
  "import_font",
  "list_fonts",
  "get_render",
  "get_export",
]);

test("every editor tool matches its editor command's parameters", () => {
  const commands = new Map(
    AgentCommandSchema.options.map((o) => [
      o.shape.action.value as string,
      Object.keys(o.shape).filter((k) => k !== "action"),
    ]),
  );
  for (const tool of editorTools) {
    if (serviceTools.has(tool.name)) continue;
    const fields = commands.get(tool.name);
    assert.ok(fields, `${tool.name} has no editor command`);
    const input = Object.keys(tool.input);
    // detach_audio takes a track number; the service extracts it to audioSrc.
    const expected =
      tool.name === "detach_audio"
        ? fields.filter((f) => f !== "audioSrc").concat("track")
        : fields;
    assert.deepEqual(input.sort(), [...expected].sort(), tool.name);
  }
});

test("tool schemas convert to JSON schema and access levels are deliberate", () => {
  for (const tool of editorTools) {
    assert.doesNotThrow(() => z.toJSONSchema(z.object(tool.input)), tool.name);
    assert.ok(tool.description.length < 1200, tool.name);
  }
  const access = (name: string) =>
    editorTools.find((t) => t.name === name)!.access;
  for (const name of [
    "delete_layers",
    "delete_track",
    "delete_media",
    "ripple_delete",
    "ripple_delete_clips",
    "cut_source_ranges",
    "apply_project",
    "set_project_settings",
    "remove_effect",
  ])
    assert.equal(access(name), "edit", name);
  for (const name of ["get_project", "find_effects", "view_timeline_range"])
    assert.equal(access(name), "read", name);
});

test("conventions take changeable values from the source", () => {
  assert.match(
    agentConventions,
    new RegExp(`at most ${LIMITS.elementEffects} effects`),
  );
  assert.match(mcpInstructions, /needsConfirmation/);
  assert.ok(mcpInstructions.includes(agentConventions));
});

test("without an in-app dialog, analysis returns the estimate and images come back as URLs", async () => {
  const posted: string[] = [];
  const ctx = {
    command: async () => ({ project: { layers: [] } }),
    get: async () => ({}),
    post: async (route: string) => {
      posted.push(route);
      if (route === "/api/analysis/estimate")
        return { tier: "balanced", estimate: { assets: 1, modelCalls: 2 } };
      return { url: "/api/views/t.png", start: 0, end: 2 };
    },
    importFile: async () => {
      throw new Error("unused");
    },
    by: "mcp" as const,
  };
  const analysis = await runTool("analyze_assets", {}, ctx);
  assert.equal(
    (analysis.result as { needsConfirmation: boolean }).needsConfirmation,
    true,
  );
  assert.deepEqual(posted, ["/api/analysis/estimate"]);
  const view = await runTool("view_timeline_range", { start: 0, end: 2 }, ctx);
  assert.equal(view.image?.url, "/api/views/t.png");
  await assert.rejects(runTool("read_any_file", {}, ctx), /not available/);
  await assert.rejects(
    runTool("import_media", { path: "relative.mov" }, ctx),
    /absolute path/,
  );
});
