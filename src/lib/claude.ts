import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
export const CHAT_EFFORT = (process.env.CLAUDE_EFFORT as Effort) || "medium";

// Server-side refusal fallback: if a request is declined by a safety classifier,
// the API re-runs it on a fallback model inside the same call.
// Not every model supports it (e.g. Claude Haiku 5.5 does not), so it is gated.
const BETAS: Anthropic.Beta.AnthropicBeta[] = ["server-side-fallback-2026-07-01"];
const FALLBACK_MODELS = ["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-2", "claude-fable-5-1"];

/** Extra request fields that turn on the refusal fallback when the model supports it. */
export function fallbackParams(): { betas?: Anthropic.Beta.AnthropicBeta[]; fallbacks?: "default" } {
  return FALLBACK_MODELS.includes(MODEL) ? { betas: BETAS, fallbacks: "default" } : {};
}

let client: Anthropic | null = null;
export function claude(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

/** Concatenate the visible text blocks of a response. */
export function textOf(content: Anthropic.Beta.Messages.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
