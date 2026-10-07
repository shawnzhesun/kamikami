import test from "node:test";
import assert from "node:assert/strict";
import { respond, type ModelRequest } from "../server/assistant-model";
// @ts-expect-error Shared JavaScript provider fixture has no declaration file.
import { responseEvents } from "./fixtures/assistant-provider.mjs";
const request = (): ModelRequest => ({
  apiKey: "fixture-not-a-real-key",
  model: "test",
  input: [{ role: "user", content: "hello" }],
  tools: [],
  instructions: "Test",
  signal: new AbortController().signal,
  onText: () => {},
});
test("OpenAI adapter streams text and sends bounded stateless serial tool requests", async () => {
  let text = "";
  const r = request();
  r.onText = (value) => (text += value);
  const result = await respond(r, async (_url, init) => {
    const body = JSON.parse(init!.body as string);
    assert.equal(body.store, false);
    assert.equal(body.parallel_tool_calls, false);
    assert.equal(body.max_output_tokens, 8000);
    return new Response(responseEvents([], "Hello editor"), {
      headers: { "Content-Type": "text/event-stream" },
    });
  });
  assert.equal(text, "Hello editor");
  assert.equal(result.calls.length, 0);
  assert.equal(result.items[0].type, "message");
});
test("OpenAI adapter returns callable tool arguments and replayable output", async () => {
  const output = [
    {
      type: "function_call",
      id: "fc_test",
      call_id: "call_test",
      name: "get_project",
      arguments: "{}",
      status: "completed",
    },
  ];
  const result = await respond(
    request(),
    async () =>
      new Response(responseEvents(output), {
        headers: { "Content-Type": "text/event-stream" },
      }),
  );
  assert.deepEqual(result.calls, [
    { id: "call_test", name: "get_project", arguments: "{}" },
  ]);
  assert.equal(result.items[0].type, "function_call");
});
test("OpenAI adapter rejects incomplete streams instead of reporting success", async () => {
  await assert.rejects(
    respond(
      request(),
      async () =>
        new Response(responseEvents([], "", "incomplete"), {
          headers: { "Content-Type": "text/event-stream" },
        }),
    ),
    /incomplete/,
  );
});

function chatStream(chunks: unknown[]) {
  return new Response(
    chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") +
      "data: [DONE]\n\n",
    { headers: { "Content-Type": "text/event-stream" } },
  );
}
test("LiteLLM chat uses the configured endpoint/key/model and assembles streamed tools", async () => {
  const r = {
    ...request(),
    baseURL: "https://proxy.example/v1/",
    apiMode: "chat" as const,
    model: "Azure deployment/model alias",
  };
  r.tools = [
    {
      type: "function",
      name: "get_project",
      description: "Read editor",
      parameters: { type: "object", properties: {} },
      strict: false,
    },
  ];
  const result = await respond(r, async (url, init) => {
    assert.equal(String(url), "https://proxy.example/v1/chat/completions");
    assert.equal(
      new Headers(init?.headers).get("authorization"),
      "Bearer fixture-not-a-real-key",
    );
    const body = JSON.parse(init!.body as string);
    assert.equal(body.model, r.model);
    assert.equal(body.tools[0].function.name, "get_project");
    assert.equal(body.include, undefined);
    assert.equal(body.store, undefined);
    return chatStream([
      {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call_proxy",
                  function: { name: "get_project", arguments: "{" },
                },
              ],
            },
          },
        ],
      },
      {
        choices: [
          {
            delta: { tool_calls: [{ index: 0, function: { arguments: "}" } }] },
            finish_reason: "tool_calls",
          },
        ],
      },
    ]);
  });
  assert.deepEqual(result.calls, [
    { id: "call_proxy", name: "get_project", arguments: "{}" },
  ]);
  let text = "";
  r.onText = (chunk) => (text += chunk);
  r.input.push(
    ...result.items,
    {
      type: "function_call_output",
      call_id: "call_proxy",
      output: '{"revision":"a:1"}',
    },
    {
      role: "user",
      content: [
        {
          type: "input_image",
          image_url: "data:image/png;base64,AQID",
          detail: "auto",
        },
      ],
    },
  );
  await respond(r, async (_url, init) => {
    const body = JSON.parse(init!.body as string);
    assert.equal(body.messages[2].tool_calls[0].id, "call_proxy");
    assert.deepEqual(body.messages[3], {
      role: "tool",
      tool_call_id: "call_proxy",
      content: '{"revision":"a:1"}',
    });
    assert.equal(
      body.messages[4].content[0].image_url.url,
      "data:image/png;base64,AQID",
    );
    return chatStream([
      { choices: [{ delta: { content: "Ready" }, finish_reason: "stop" }] },
    ]);
  });
  assert.equal(text, "Ready");
});
test("custom Responses endpoint omits OpenAI-only encrypted reasoning", async () => {
  await respond(
    { ...request(), baseURL: "https://proxy.example/v1", apiMode: "responses" },
    async (url, init) => {
      assert.equal(String(url), "https://proxy.example/v1/responses");
      assert.equal(JSON.parse(init!.body as string).include, undefined);
      return new Response(responseEvents([], "Ready"), {
        headers: { "Content-Type": "text/event-stream" },
      });
    },
  );
});
test("chat truncation is an error rather than an executed partial tool call", async () => {
  await assert.rejects(
    respond({ ...request(), apiMode: "chat" }, async () =>
      chatStream([
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "cut",
                    function: { name: "delete_layers", arguments: "{" },
                  },
                ],
              },
              finish_reason: "length",
            },
          ],
        },
      ]),
    ),
    /incomplete/,
  );
});
