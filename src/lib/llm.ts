import "server-only";
import Groq from "groq-sdk";
import { MODEL, claude, fallbackParams, textOf, type Effort } from "./claude";
import { GROQ_CHAT_MODEL, GROQ_FAST_MODEL, GROQ_VISION_MODEL, groq, reasoningParams } from "./groq";

export type Provider = "anthropic" | "groq" | "mock";

/**
 * Which AI provider to use. AI_PROVIDER wins if set; otherwise the first key found.
 * Without any key the app runs in clearly labelled mock mode.
 */
export function provider(): Provider {
  const forced = process.env.AI_PROVIDER as Provider | undefined;
  if (forced === "mock") return "mock";
  if (forced === "anthropic" && (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)) return "anthropic";
  if (forced === "groq" && process.env.GROQ_API_KEY) return "groq";
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return "anthropic";
  if (process.env.GROQ_API_KEY) return "groq";
  return "mock";
}

export function aiEnabled(): boolean {
  return provider() !== "mock";
}

export function providerLabel(): string {
  const p = provider();
  if (p === "anthropic") return `Claude (${MODEL})`;
  if (p === "groq") return `Groq (${GROQ_CHAT_MODEL})`;
  return "Mock mode";
}

export interface ImageInput {
  mediaType: "image/png" | "image/jpeg" | "image/webp";
  base64: string;
}

/** One structured-output call. Returns parsed JSON matching `schema`. */
export async function jsonCall<T>(opts: {
  system: string;
  user: string;
  image?: ImageInput;
  schema: Record<string, unknown>;
  schemaName: string;
  /** Use the smaller, faster Groq model (for quick checks). */
  fast?: boolean;
  effort?: Effort;
}): Promise<T> {
  if (provider() === "anthropic") {
    const content: import("@anthropic-ai/sdk").default.Beta.Messages.BetaContentBlockParam[] = [];
    if (opts.image) {
      content.push({ type: "image", source: { type: "base64", media_type: opts.image.mediaType, data: opts.image.base64 } });
    }
    content.push({ type: "text", text: opts.user });
    const res = await claude().beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      ...fallbackParams(),
      system: opts.system,
      output_config: { effort: opts.effort ?? "low", format: { type: "json_schema", schema: opts.schema } },
      messages: [{ role: "user", content }],
    });
    if (res.stop_reason === "refusal") throw new Error("The model declined this request.");
    if (res.stop_reason === "max_tokens") throw new Error("The response was cut off.");
    return JSON.parse(textOf(res.content)) as T;
  }

  if (provider() === "groq") {
    const model = opts.image ? GROQ_VISION_MODEL : opts.fast ? GROQ_FAST_MODEL : GROQ_CHAT_MODEL;
    const userContent: Groq.Chat.Completions.ChatCompletionContentPart[] = [{ type: "text", text: opts.user }];
    if (opts.image) {
      userContent.push({ type: "image_url", image_url: { url: `data:${opts.image.mediaType};base64,${opts.image.base64}` } });
    }
    const base = {
      model,
      max_completion_tokens: 4000,
      ...reasoningParams(model),
    };
    let text: string;
    try {
      const res = await groq().chat.completions.create({
        ...base,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: userContent },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: opts.schemaName, schema: opts.schema, strict: true },
        },
      });
      text = res.choices[0]?.message?.content ?? "";
    } catch (e) {
      if (!(e instanceof Groq.BadRequestError)) throw e;
      // Some model/input combinations reject strict schemas: fall back to JSON mode
      // with the schema spelled out in the prompt.
      const res = await groq().chat.completions.create({
        ...base,
        messages: [
          {
            role: "system",
            content: `${opts.system}\n\nReply with only a JSON object that matches this JSON Schema exactly:\n${JSON.stringify(opts.schema)}`,
          },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      });
      text = res.choices[0]?.message?.content ?? "";
    }
    return JSON.parse(text) as T;
  }

  throw new Error("No AI provider configured");
}

/** One short plain-text call (reminders, counsellor call briefs). */
export async function textCall(opts: { system: string; user: string; maxTokens?: number }): Promise<string> {
  if (provider() === "anthropic") {
    const res = await claude().beta.messages.create({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 2000,
      ...fallbackParams(),
      output_config: { effort: "low" },
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    });
    return textOf(res.content);
  }
  if (provider() === "groq") {
    const res = await groq().chat.completions.create({
      model: GROQ_FAST_MODEL,
      max_completion_tokens: opts.maxTokens ?? 2000,
      ...reasoningParams(GROQ_FAST_MODEL),
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    });
    return (res.choices[0]?.message?.content ?? "").trim();
  }
  throw new Error("No AI provider configured");
}
