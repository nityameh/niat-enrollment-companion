import "server-only";
import Groq from "groq-sdk";

// Groq models (free tier has per-model limits, so work is spread across models).
export const GROQ_CHAT_MODEL = process.env.GROQ_CHAT_MODEL || "openai/gpt-oss-120b";
export const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b";
export const GROQ_FAST_MODEL = process.env.GROQ_FAST_MODEL || "openai/gpt-oss-20b";

// Backups tried in order when a model hits its rate limit (each has its own free quota).
const BACKUPS = (process.env.GROQ_FALLBACK_MODELS || "openai/gpt-oss-20b,llama-3.3-70b-versatile")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

/** The primary model followed by the backups, without duplicates. */
export function modelChain(primary: string): string[] {
  return [primary, ...BACKUPS.filter((m) => m !== primary)];
}

let client: Groq | null = null;
export function groq(): Groq {
  // One quick retry only: on a rate limit we would rather switch model than wait.
  if (!client) client = new Groq({ maxRetries: 1, timeout: 45_000 }); // reads GROQ_API_KEY
  return client;
}

/** gpt-oss models accept a reasoning effort. Low saves free-tier tokens; the chat agent uses medium for accuracy. */
export function reasoningParams(
  model: string,
  effort: "low" | "medium" = "low",
): { reasoning_effort?: "low" | "medium" } {
  return model.startsWith("openai/gpt-oss") ? { reasoning_effort: effort } : {};
}

/**
 * Run a Groq call on the first model in `models`; if it is rate-limited or overloaded,
 * try the next one. Other errors are thrown straight away.
 */
export async function withGroqFallback<T>(models: string[], call: (model: string) => Promise<T>): Promise<T> {
  let last: unknown;
  for (const model of models) {
    try {
      return await call(model);
    } catch (e) {
      const busy = e instanceof Groq.RateLimitError || (e instanceof Groq.APIError && (e.status === 503 || e.status === 498));
      if (!busy) throw e;
      last = e;
    }
  }
  throw last;
}
