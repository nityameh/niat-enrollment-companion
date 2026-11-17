import "server-only";
import type { KnowledgeEntry } from "./types";
import { aiEnabled, jsonCall } from "./llm";

// Real public-data integration: fetch NIAT's own information page and check whether each
// public fact that cites it is still supported. Nothing is changed automatically; the
// company sees what drifted and decides.

export const LIVE_SOURCE = "https://www.niatindia.com/llm-info";

export interface FactCheck {
  id: string;
  title: string;
  status: "supported" | "changed" | "not_found";
  note: string;
}

export interface RefreshResult {
  at: number;
  source: string;
  pageChars: number;
  checks: FactCheck[];
}

/** Very small HTML-to-text: drop scripts/styles/tags, collapse whitespace. */
function pageText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

const SCHEMA = {
  type: "object",
  properties: {
    checks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          status: { type: "string", enum: ["supported", "changed", "not_found"] },
          note: { type: "string" },
        },
        required: ["id", "status", "note"],
        additionalProperties: false,
      },
    },
  },
  required: ["checks"],
  additionalProperties: false,
};

export async function checkFactsAgainstSite(knowledge: KnowledgeEntry[]): Promise<RefreshResult> {
  if (!aiEnabled()) throw new Error("Checking facts needs an AI provider key.");
  const res = await fetch(LIVE_SOURCE, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; EnrollmentCompanionDemo/1.0)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Could not fetch ${LIVE_SOURCE} (${res.status})`);
  const text = pageText(await res.text()).slice(0, 14_000);

  const facts = knowledge.filter((k) => k.kind === "public" && k.source === LIVE_SOURCE);
  const out = await jsonCall<{ checks: Omit<FactCheck, "title">[] }>({
    system:
      "You compare short facts against the text of a company's official web page. For each fact decide: supported (the page says the same thing), changed (the page now says something different, e.g. a new number or date; explain what changed), or not_found (the page does not cover it). Be strict about numbers and dates. Notes: one short sentence in English.",
    user: `PAGE TEXT (${LIVE_SOURCE}):\n${text}\n\nFACTS:\n${facts.map((f) => `[${f.id}] ${f.answer}`).join("\n")}`,
    schema: SCHEMA,
    schemaName: "fact_check",
    fast: true,
  });

  const titles = new Map(facts.map((f) => [f.id, f.title]));
  return {
    at: Date.now(),
    source: LIVE_SOURCE,
    pageChars: text.length,
    checks: out.checks.filter((c) => titles.has(c.id)).map((c) => ({ ...c, title: titles.get(c.id) ?? c.id })),
  };
}
