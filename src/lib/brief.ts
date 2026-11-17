import "server-only";
import type { DecisionBrief, Lead } from "./types";
import { LANG_NAMES } from "./types";
import { knowledgePrompt, normalizeCitations } from "./knowledge";
import { aiEnabled, jsonCall } from "./llm";
import { getUniversity, loadDb, logEvent, newId, now, touch } from "./store";

const str = { type: "string" };
const strList = { type: "array", items: str };

const SCHEMA = {
  type: "object",
  properties: {
    headline: str,
    summary: str,
    what_niat_is: str,
    strengths: strList,
    concerns: {
      type: "array",
      items: {
        type: "object",
        properties: { concern: str, honest_answer: str, source_ids: strList },
        required: ["concern", "honest_answer", "source_ids"],
        additionalProperties: false,
      },
    },
    money_note: str,
    what_to_verify: strList,
    questions_to_ask: strList,
    next_steps: strList,
  },
  required: [
    "headline",
    "summary",
    "what_niat_is",
    "strengths",
    "concerns",
    "money_note",
    "what_to_verify",
    "questions_to_ask",
    "next_steps",
  ],
  additionalProperties: false,
};

type BriefBody = Omit<DecisionBrief, "generatedAt" | "mode" | "language">;

export async function generateBrief(lead: Lead): Promise<DecisionBrief> {
  const uni = getUniversity(lead.universityId);
  let body: BriefBody;
  let mode: "ai" | "mock" = "mock";

  if (aiEnabled()) {
    const worries = lead.objections.map((o) => `${o.type} (${o.severity}): ${o.summary}`).join("\n") || "none logged";
    const recent = lead.chat.slice(-12).map((m) => `${m.role}: ${m.text}`).join("\n");
    body = await jsonCall<BriefBody>({
      system: `You write a one-page Decision Brief for an Indian family deciding whether their child should join NIAT after counselling. It must be balanced and honest: it helps them decide, it does not sell. Use ONLY the knowledge below (never general knowledge), and put the ids you relied on in source_ids:\n${knowledgePrompt(loadDb().knowledge, loadDb().settings.answerMode)}\n\nWrite every field in ${LANG_NAMES[lead.language]} using simple everyday words. Never state fees, scholarship amounts, placement rates or university rules that are not in the knowledge; instead add them to what_to_verify or questions_to_ask. 3-5 items per list.`,
      user: `Student: ${lead.studentName}; Parent: ${lead.parentName}; City: ${lead.city}\nSuggested university: ${uni?.name} in ${uni?.city} (demo)\nCounsellor notes: ${lead.counsellingNotes}\nWorries raised so far:\n${worries}\nRecent conversation:\n${recent}`,
      schema: SCHEMA,
      schemaName: "decision_brief",
      effort: "medium",
    });
    mode = "ai";
  } else {
    body = mockBrief(lead, uni?.name ?? "the collaborating university");
  }

  // Normalise citation formats in every string field (the model may write "(F1, F2)").
  const fixed = JSON.parse(JSON.stringify(body), (_k, v) => (typeof v === "string" ? normalizeCitations(v) : v)) as BriefBody;
  const brief: DecisionBrief = { ...fixed, generatedAt: now(), mode, language: mode === "ai" ? lead.language : "en" };
  lead.brief = brief;
  lead.chat.push({ id: newId("m"), role: "agent", text: brief.headline, ts: now(), kind: "brief" });
  logEvent(lead.id, "brief_generated", { mode });
  touch(lead);
  return brief;
}

function mockBrief(lead: Lead, uniName: string): BriefBody {
  return {
    headline: `Should ${lead.studentName.split(" ")[0]} join NIAT? A balanced summary`,
    summary:
      "This brief lists what NIAT is, what looks strong, the honest answers to your worries, and what to confirm in writing before paying the first-term fee. (mock mode: written from a template, not by AI)",
    what_niat_is: `NIAT is an upskilling programme by NxtWave that runs alongside the B.Tech at ${uniName}. NIAT is not a university; the degree comes from the collaborating university [F1][F2].`,
    strengths: [
      "AI-first, project-based curriculum from the first phase [F8]",
      "Separate Industry Ready Certificate in addition to the degree [F7]",
      "You can talk to current NIAT students before deciding [F12]",
    ],
    concerns: [
      {
        concern: "Is the degree real?",
        honest_answer: "Yes, the B.Tech is awarded by the collaborating university, which is UGC-recognised or AICTE-approved. NIAT's certificate is extra and non-credit [F2][F7].",
        source_ids: ["F2", "F7"],
      },
      {
        concern: "Will there be a job?",
        honest_answer: "NIAT reports hiring by 2,500+ companies across NxtWave programmes, but enrolling does not guarantee a job [F10].",
        source_ids: ["F10"],
      },
    ],
    money_note: "NIAT's public pages don't list total fees. Ask for the full 4-year cost, scholarship terms and refund rules in writing [F14].",
    what_to_verify: [
      "The university's UGC/AICTE status on the official lists",
      "Total 4-year cost (university + NIAT) in writing",
      "Scholarship conditions and refund policy in writing",
    ],
    questions_to_ask: [
      "What did the last batch at this campus actually achieve (internships, placements)?",
      "What happens to the NIAT programme if the partnership with the university ends?",
      "Who teaches day-to-day classes?",
    ],
    next_steps: ["Talk to a current student [F12]", "Book a call with the counsellor for the fee breakdown", "Decide together as a family"],
  };
}
