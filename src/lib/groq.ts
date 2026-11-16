import "server-only";
import Groq from "groq-sdk";

// Groq models (free tier has per-model limits, so work is spread across three models).
export const GROQ_CHAT_MODEL = process.env.GROQ_CHAT_MODEL || "openai/gpt-oss-120b";
export const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b";
export const GROQ_FAST_MODEL = process.env.GROQ_FAST_MODEL || "openai/gpt-oss-20b";

let client: Groq | null = null;
export function groq(): Groq {
  if (!client) client = new Groq(); // reads GROQ_API_KEY
  return client;
}

/** gpt-oss models accept a reasoning effort. Low saves free-tier tokens; the chat agent uses medium for accuracy. */
export function reasoningParams(
  model: string,
  effort: "low" | "medium" = "low",
): { reasoning_effort?: "low" | "medium" } {
  return model.startsWith("openai/gpt-oss") ? { reasoning_effort: effort } : {};
}
