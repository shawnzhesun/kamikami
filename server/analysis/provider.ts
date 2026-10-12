import OpenAI, { toFile } from "openai";
import { BaseUrlSchema, OPENAI_BASE_URL } from "../../src/assistant-connection";

/** The assistant's connection, borrowed for analysis calls (the key never leaves the service). */
export type ProviderConnection = {
  apiKey: string;
  baseURL: string;
  model: string;
  apiMode: "responses" | "chat";
};

export const providerHost = (connection: { baseURL: string }) => {
  try {
    return new URL(connection.baseURL).host;
  } catch {
    return connection.baseURL;
  }
};

function client(connection: ProviderConnection, fetcher?: typeof fetch) {
  return new OpenAI({
    apiKey: connection.apiKey,
    baseURL: BaseUrlSchema.parse(connection.baseURL || OPENAI_BASE_URL),
    maxRetries: 1,
    timeout: 180_000,
    ...(fetcher ? { fetch: fetcher } : {}),
  });
}

/** Pull the first JSON object out of a model reply (tolerates code fences and prose). */
export function parseJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start)
    throw new Error("The model did not return JSON.");
  return JSON.parse(text.slice(start, end + 1));
}

/** One prompt with optional JPEG images; returns parsed JSON. Works with both API modes. */
export async function askJson(
  connection: ProviderConnection,
  prompt: string,
  images: Buffer[],
  {
    model,
    signal,
    fetcher,
  }: { model?: string; signal?: AbortSignal; fetcher?: typeof fetch } = {},
): Promise<unknown> {
  const c = client(connection, fetcher);
  const use = model || connection.model;
  const urls = images.map(
    (b) => `data:image/jpeg;base64,${b.toString("base64")}`,
  );
  if (connection.apiMode === "chat") {
    const reply = await c.chat.completions.create(
      {
        model: use,
        max_tokens: 3000,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              ...urls.map((url) => ({
                type: "image_url" as const,
                image_url: { url, detail: "low" as const },
              })),
            ],
          },
        ],
      },
      { signal },
    );
    return parseJson(reply.choices[0]?.message?.content ?? "");
  }
  const reply = await c.responses.create(
    {
      model: use,
      store: false,
      max_output_tokens: 3000,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            ...urls.map((image_url) => ({
              type: "input_image" as const,
              image_url,
              detail: "low" as const,
            })),
          ],
        },
      ],
    },
    { signal },
  );
  return parseJson(reply.output_text ?? "");
}

export type RawTranscript = {
  language?: string;
  text: string;
  segments: { start: number; end: number; text: string }[];
  words: { t: string; s: number; e: number }[];
};
/**
 * Word-timestamped transcription via `/audio/transcriptions` (whisper-1 style
 * verbose_json). Throws when the endpoint returns no word timings, because
 * editing and lyric alignment depend on them.
 */
export async function transcribeAudio(
  connection: ProviderConnection,
  audio: Buffer,
  {
    model,
    prompt,
    signal,
    fetcher,
  }: {
    model: string;
    prompt?: string;
    signal?: AbortSignal;
    fetcher?: typeof fetch;
  },
): Promise<RawTranscript> {
  const c = client(connection, fetcher);
  const reply = (await c.audio.transcriptions.create(
    {
      file: await toFile(audio, "audio.mp3", { type: "audio/mpeg" }),
      model,
      response_format: "verbose_json",
      timestamp_granularities: ["word", "segment"],
      ...(prompt ? { prompt: prompt.slice(0, 1500) } : {}),
    },
    { signal },
  )) as unknown as {
    language?: string;
    text?: string;
    words?: { word: string; start: number; end: number }[];
    segments?: { start: number; end: number; text: string }[];
  };
  if (!Array.isArray(reply.words))
    throw new Error(
      "This provider's transcription endpoint did not return word timings. Use a whisper-1 compatible model.",
    );
  return {
    language: reply.language,
    text: reply.text ?? "",
    segments: (reply.segments ?? []).map((s) => ({
      start: s.start,
      end: s.end,
      text: String(s.text ?? "").trim(),
    })),
    words: reply.words.map((w) => ({
      t: String(w.word).trim(),
      s: w.start,
      e: w.end,
    })),
  };
}
