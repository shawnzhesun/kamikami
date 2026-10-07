import OpenAI from "openai";
import { OPENAI_BASE_URL, BaseUrlSchema } from "../src/assistant-connection";
import type {
  ChatCompletionMessageParam,
  ChatCompletionContentPart,
} from "openai/resources/chat/completions";
import { toResponseInputItems } from "openai/lib/responses/ResponseInputItems";
import type {
  ResponseInputItem,
  FunctionTool,
} from "openai/resources/responses/responses";
export type ModelReply = {
  items: ResponseInputItem[];
  calls: { id: string; name: string; arguments: string }[];
};
export type ModelRequest = {
  name?: string;
  baseURL?: string;
  apiMode?: "responses" | "chat";
  apiKey: string;
  model: string;
  input: ResponseInputItem[];
  tools: FunctionTool[];
  instructions: string;
  signal: AbortSignal;
  onText: (text: string) => void;
};
export async function respond(
  request: ModelRequest,
  fetcher?: typeof fetch,
): Promise<ModelReply> {
  const client = new OpenAI({
    apiKey: request.apiKey,
    baseURL: BaseUrlSchema.parse(request.baseURL ?? OPENAI_BASE_URL),
    maxRetries: 0,
    timeout: 120000,
    ...(fetcher ? { fetch: fetcher } : {}),
  });
  if (request.apiMode === "chat") return respondChat(client, request);
  const stream = client.responses.stream(
    {
      model: request.model,
      input: request.input,
      tools: request.tools,
      instructions: request.instructions,
      parallel_tool_calls: false,
      store: false,
      ...((request.baseURL ?? OPENAI_BASE_URL) === OPENAI_BASE_URL
        ? { include: ["reasoning.encrypted_content" as const] }
        : {}),
      max_output_tokens: 8000,
    },
    { signal: request.signal },
  );
  stream.on("response.output_text.delta", (event) =>
    request.onText(event.delta),
  );
  const response = await stream.finalResponse();
  if (response.status !== "completed") {
    throw new Error(
      response.error?.message ||
        "The model response was incomplete. Try a smaller edit.",
    );
  }
  return {
    items: toResponseInputItems(response.output),
    calls: response.output.flatMap((item) =>
      item.type === "function_call"
        ? [{ id: item.call_id, name: item.name, arguments: item.arguments }]
        : [],
    ),
  };
}

/** Translate the editor's transport-neutral tool history to OpenAI-compatible chat. */
export function chatMessages(
  request: ModelRequest,
): ChatCompletionMessageParam[] {
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: request.instructions },
  ];
  for (const item of request.input) {
    if (item.type === "function_call") {
      const call = {
        id: item.call_id,
        type: "function" as const,
        function: { name: item.name, arguments: item.arguments },
      };
      const last = messages.at(-1);
      if (last?.role === "assistant")
        last.tool_calls = [...(last.tool_calls ?? []), call];
      else
        messages.push({ role: "assistant", content: null, tool_calls: [call] });
    } else if (item.type === "function_call_output") {
      if (!item.call_id) throw new Error("Tool result is missing its call ID.");
      messages.push({
        role: "tool",
        tool_call_id: item.call_id,
        content:
          typeof item.output === "string"
            ? item.output
            : JSON.stringify(item.output),
      });
    } else if ("role" in item && "content" in item) {
      if (typeof item.content === "string") {
        messages.push({
          role:
            item.role === "assistant"
              ? "assistant"
              : item.role === "system" || item.role === "developer"
                ? "system"
                : "user",
          content: item.content,
        });
      } else if (Array.isArray(item.content)) {
        if (item.role === "assistant") {
          messages.push({
            role: "assistant",
            content: item.content
              .map((part) => ("text" in part ? part.text : ""))
              .join(""),
          });
        } else {
          const content: ChatCompletionContentPart[] = [];
          for (const part of item.content) {
            if ("text" in part && typeof part.text === "string")
              content.push({ type: "text", text: part.text });
            else if (part.type === "input_image" && part.image_url)
              content.push({
                type: "image_url",
                image_url: {
                  url: part.image_url,
                  detail:
                    part.detail === "original"
                      ? "high"
                      : (part.detail ?? "auto"),
                },
              });
          }
          messages.push({ role: "user", content });
        }
      }
    }
  }
  return messages;
}
async function respondChat(
  client: OpenAI,
  request: ModelRequest,
): Promise<ModelReply> {
  const stream = await client.chat.completions.create(
    {
      model: request.model,
      messages: chatMessages(request),
      tools: request.tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description ?? undefined,
          parameters: tool.parameters ?? undefined,
        },
      })),
      parallel_tool_calls: false,
      max_completion_tokens: 8000,
      stream: true,
    },
    { signal: request.signal },
  );
  const calls = new Map<
    number,
    { id: string; name: string; arguments: string }
  >();
  let text = "",
    finish: string | null = null;
  for await (const chunk of stream) {
    const choice = chunk.choices[0];
    if (!choice) continue;
    if (choice.delta.content) {
      text += choice.delta.content;
      request.onText(choice.delta.content);
    }
    for (const delta of choice.delta.tool_calls ?? []) {
      const call = calls.get(delta.index) ?? {
        id: "",
        name: "",
        arguments: "",
      };
      if (delta.id) call.id = delta.id;
      if (delta.function?.name) call.name += delta.function.name;
      if (delta.function?.arguments) call.arguments += delta.function.arguments;
      calls.set(delta.index, call);
    }
    if (choice.finish_reason) finish = choice.finish_reason;
  }
  request.signal.throwIfAborted();
  if (!["stop", "tool_calls"].includes(finish ?? ""))
    throw new Error("The model response was incomplete. Try a smaller edit.");
  const complete = [...calls.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, call]) => call);
  if (complete.some((call) => !call.id || !call.name))
    throw new Error("The proxy returned an incomplete tool call.");
  return {
    items: [
      ...(text ? [{ role: "assistant" as const, content: text }] : []),
      ...complete.map((call) => ({
        type: "function_call" as const,
        call_id: call.id,
        name: call.name,
        arguments: call.arguments,
      })),
    ],
    calls: complete,
  };
}
