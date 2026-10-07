import { z } from "zod";
export const OPENAI_BASE_URL = "https://api.openai.com/v1";
export const BaseUrlSchema = z
  .string()
  .trim()
  .max(500)
  .transform((value, ctx) => {
    try {
      const url = new URL(value);
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if (
        (url.protocol !== "https:" && !(url.protocol === "http:" && local)) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error();
      return url.href.replace(/\/+$/, "");
    } catch {
      ctx.addIssue({
        code: "custom",
        message:
          "Use an HTTPS base URL without credentials, query parameters or fragments (HTTP is allowed for localhost).",
      });
      return z.NEVER;
    }
  });
export const ConnectionSchema = z.object({
  name: z.string().trim().min(1).max(100).default("OpenAI"),
  baseURL: BaseUrlSchema.default(OPENAI_BASE_URL),
  apiMode: z.enum(["responses", "chat"]).default("responses"),
  model: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(
      /^[^\u0000-\u001f\u007f]+$/,
      "Model names cannot contain control characters.",
    ),
});
export type AssistantConnection = z.infer<typeof ConnectionSchema>;
