// Deterministic provider fixture for native UI QA. Only active when explicitly
// preloaded with node --import; never imported by the application.
export function responseEvents(output, text = "", status = "completed") {
  const response = {
    id: "resp_fixture",
    object: "response",
    created_at: 1,
    model: "kamikami-test-model",
    status: "in_progress",
    output: [],
    error: null,
    incomplete_details: null,
  };
  const events = [
    { type: "response.created", response: structuredClone(response) },
  ];
  if (text) {
    const item = {
      type: "message",
      id: "msg_fixture",
      role: "assistant",
      status: "in_progress",
      content: [],
    };
    events.push({
      type: "response.output_item.added",
      output_index: 0,
      item: structuredClone(item),
    });
    events.push({
      type: "response.content_part.added",
      output_index: 0,
      item_id: item.id,
      content_index: 0,
      part: { type: "output_text", text: "", annotations: [], logprobs: [] },
    });
    events.push({
      type: "response.output_text.delta",
      output_index: 0,
      item_id: item.id,
      content_index: 0,
      delta: text,
      logprobs: [],
    });
    output = [
      {
        ...item,
        status: "completed",
        content: [{ type: "output_text", text, annotations: [], logprobs: [] }],
      },
    ];
  }
  events.push({
    type: status === "completed" ? "response.completed" : "response.incomplete",
    response: { ...response, status, output },
  });
  return (
    events
      .map(
        (event, i) =>
          `event: ${event.type}\ndata: ${JSON.stringify({ ...event, sequence_number: i })}\n\n`,
      )
      .join("") + "data: [DONE]\n\n"
  );
}
export async function fixtureFetch(url, init) {
  if (!String(url).startsWith("https://api.openai.com/v1/responses"))
    throw new Error("Unexpected provider URL in test");
  const body = JSON.parse(init.body);
  const initial = body.input.find(
    (i) =>
      typeof i.content === "string" &&
      i.content.startsWith("Current editor context (data): "),
  );
  const snapshot = JSON.parse(
    initial.content.slice("Current editor context (data): ".length),
  );
  const outputs = body.input.filter((i) => i.type === "function_call_output");
  const last = outputs.length ? JSON.parse(outputs.at(-1).output) : snapshot;
  const user =
    body.input
      .filter(
        (i) =>
          i.role === "user" &&
          typeof i.content === "string" &&
          !i.content.startsWith("Current editor context"),
      )
      .at(-1)?.content || "";
  let name, args;
  if (user.includes("QA stop")) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 30000);
      init.signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        },
        { once: true },
      );
    });
  } else if (user.includes("QA delete")) {
    if (!outputs.length) {
      name = "delete_layers";
      args = {
        layerIds: [snapshot.project.layers.at(-1).id],
        expectedRevision: snapshot.revision,
      };
    }
  } else if (user.includes("QA native")) {
    if (!outputs.length) {
      name = "add_text";
      args = {
        text: "NATIVE ASSISTANT QA",
        name: "Assistant QA title",
        start: 0,
        duration: 3,
        expectedRevision: snapshot.revision,
      };
    } else if (outputs.length === 1 && !last.error) {
      name = "update_layer";
      args = {
        layerId: last.project.layers.at(-1).id,
        patch: { x: 0, y: 300, color: "#F2765E", fontSize: 65 },
        expectedRevision: last.revision,
      };
    } else if (outputs.length === 2 && !last.error) {
      name = "select_layers";
      args = { layerIds: [last.project.layers.at(-1).id] };
    }
  }
  const output = name
    ? [
        {
          type: "function_call",
          id: `fc_${outputs.length}`,
          call_id: `call_${outputs.length}`,
          name,
          arguments: JSON.stringify(args),
          status: "completed",
        },
      ]
    : [];
  const text = name
    ? ""
    : last.error
      ? `The change was not applied: ${last.error}`
      : user.includes("QA native")
        ? "Added a coral title for the first three seconds and positioned it below the main title. Use Undo edits to restore your composition. (Simulated model for QA.)"
        : "Your clips are unchanged. (Simulated model for QA.)";
  return new Response(responseEvents(output, text), {
    headers: { "Content-Type": "text/event-stream" },
  });
}
if (process.env.KAMIKAMI_PROVIDER_FIXTURE === "1") {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url, init) =>
    String(url).startsWith("https://api.openai.com/")
      ? fixtureFetch(url, init)
      : originalFetch(url, init);
}
