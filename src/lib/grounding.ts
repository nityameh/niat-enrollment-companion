import "server-only";
import type { Lang, Lead } from "./types";
import { activeEntries } from "./knowledge";
import { jsonCall } from "./llm";
import { loadDb } from "./store";

// A second, independent check that a reply only says what the company allows.
// Prompts alone are not a guarantee, so in "company answers only" mode every reply is
// verified before the family sees it. Set GROUNDING_CHECK=always to check in both modes.

const SCHEMA = {
  type: "object",
  properties: {
    supported: { type: "boolean" },
    unsupported_claims: { type: "array", items: { type: "string" } },
  },
  required: ["supported", "unsupported_claims"],
  additionalProperties: false,
};

export function groundingEnabled(): boolean {
  return process.env.GROUNDING_CHECK === "always" || loadDb().settings.answerMode === "company_only";
}

export async function checkGrounded(reply: string, lead: Lead): Promise<{ supported: boolean; claims: string[] }> {
  const db = loadDb();
  const allowed = activeEntries(db.knowledge, db.settings.answerMode)
    .map((e) => `[${e.id}] ${e.answer}`)
    .join("\n");
  const res = await jsonCall<{ supported: boolean; unsupported_claims: string[] }>({
    system: `You are a strict fact checker for a company chatbot. Decide whether the REPLY states any fact about NIAT, NxtWave, universities, degrees, fees, placements, recognition or policies that is NOT supported by the ALLOWED KNOWLEDGE.
Allowed without support: greetings, empathy, offers to help or to connect a counsellor, questions back to the family, and the family's own details (name, demo university name, their documents, their deadline).
Anything else must be clearly supported by the allowed knowledge. Translations of allowed knowledge are fine. List each unsupported claim briefly in English.`,
    user: `ALLOWED KNOWLEDGE:\n${allowed || "(none)"}\n\nFAMILY: ${lead.studentName} / ${lead.parentName}, university (demo): ${lead.universityId}\n\nREPLY:\n${reply}`,
    schema: SCHEMA,
    schemaName: "grounding_check",
    fast: true,
  });
  return { supported: res.supported, claims: res.unsupported_claims ?? [] };
}

export const SAFE_FALLBACK: Record<Lang, string> = {
  en: "Good question. I don't have an approved answer for this, so your counsellor will reply personally. I've let them know.",
  hi: "अच्छा सवाल है। इसका सही जवाब आपके काउंसलर देंगे। मैंने उन्हें बता दिया है।",
  te: "మంచి ప్రశ్న. దీనికి సరైన సమాధానం మీ కౌన్సెలర్ ఇస్తారు. నేను వారికి తెలియజేశాను.",
  ta: "நல்ல கேள்வி. இதற்கான சரியான பதிலை உங்கள் ஆலோசகர் தருவார். நான் அவருக்குத் தெரிவித்துவிட்டேன்.",
  kn: "ಒಳ್ಳೆಯ ಪ್ರಶ್ನೆ. ಇದಕ್ಕೆ ಸರಿಯಾದ ಉತ್ತರವನ್ನು ನಿಮ್ಮ ಸಲಹೆಗಾರರು ನೀಡುತ್ತಾರೆ. ನಾನು ಅವರಿಗೆ ತಿಳಿಸಿದ್ದೇನೆ.",
  ml: "നല്ല ചോദ്യം. ഇതിനുള്ള ശരിയായ ഉത്തരം നിങ്ങളുടെ കൗൺസിലർ നൽകും. ഞാൻ അവരെ അറിയിച്ചിട്ടുണ്ട്.",
};
