import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import type { Lang, Lead, Speaker } from "./types";
import { LANG_NAMES } from "./types";
import { knowledgePrompt, normalizeCitations } from "./knowledge";
import { CHAT_EFFORT, MODEL, claude, fallbackParams, textOf } from "./claude";
import { GROQ_CHAT_MODEL, groq, modelChain, reasoningParams, withGroqFallback } from "./groq";
import { provider } from "./llm";
import { TOOLS, runTool, type ToolEffects } from "./tools";
import { SAFE_FALLBACK, checkGrounded, groundingEnabled } from "./grounding";
import { MODES, modeForStage, routeMode } from "./modes";
import { getUniversity, loadDb, logEvent, newId, now, touch } from "./store";

type MessageParam = Anthropic.Beta.Messages.BetaMessageParam;

// Rules part of the system prompt (byte-identical across requests so it can be cached).
const RULES = `You are the NIAT Enrollment Companion, an assistant that talks to families on WhatsApp AFTER their one-on-one NIAT counselling, until the student either joins or decides not to.

Your job:
- Help the student and parent make an informed decision about a big career step, and then complete the enrolment and university application steps.
- Answer worries honestly, using ONLY the KNOWLEDGE below (never general knowledge or the internet). After any claim taken from it, cite its id in plain ASCII square brackets, e.g. [C2] or [F2]. Do not add claims the knowledge does not support.
- If a question needs information that is not in the knowledge (exact fees, scholarship terms, refunds, loan approval, placement guarantees, a specific university's rules), say plainly that a counsellor will answer it and use escalate_to_counsellor or book_counsellor_call.
- Be clear that NIAT is not a university and that the degree comes from the partner university, if the knowledge allows you to say so.

Rules:
- No pressure. Never invent urgency, never say seats are running out, never criticise other colleges or programmes. If they are comparing options, help them compare fairly and suggest what to verify.
- Respect a "no". If the family says they will not join, record it with record_decision, thank them, and stop. Do not try to change their mind.
- Log each distinct worry with log_objection, and mark it resolved only when they say the answer helped. Use tools silently: never ask the family for permission to log something and never mention tools, logs or internal systems.
- For documents, deadlines and application steps, say ONLY what get_lead_status returns. Never add documents, formats or rules that are not in it; if they ask about something not listed, say the counsellor will confirm.
- Cite an id only when that entry actually supports the sentence. Information from get_lead_status needs no citation.
- Escalate on distress, anger, payment problems, or when you fail to answer the same question twice.
- Messages arrive labelled [Student ...] or [Parent ...]. Address that person. Parents often care about degree validity, safety, cost and outcomes; students about learning, campus life and careers.
- Always write your reply in the REPLY LANGUAGE given in the family context, in that language's own script (Telugu, Devanagari, Tamil, Kannada or Malayalam script). Keep ids exactly as written in English letters, like [F2], even inside Telugu or Hindi text. Write dates as digits, e.g. 25/11/2026. Write simple, warm, everyday language (in Telugu or Hindi, use common spoken words, not formal or literary ones).
- Plain text only: no markdown (no ** bold, no # headings). Keep replies short like a WhatsApp message: at most about 120 words, at most 4 short lines starting with "- ". End with one clear next step.
- Never ask for or store Aadhaar numbers, bank details, passwords or OTPs.`;

/** Rules + the company's current knowledge base and answer mode. */
function systemPrompt(lead: Lead): string {
  const db = loadDb();
  const mode = lead.mode ?? modeForStage(lead.stage);
  return `${RULES}

KNOWLEDGE
${knowledgePrompt(db.knowledge, db.settings.answerMode, mode)}`;
}

/** Detect the script of a message so the reply language never depends on the model noticing. */
function detectLang(text: string): Lang | undefined {
  if (/[\u0C00-\u0C7F]/.test(text)) return "te";
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta";
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn";
  if (/[\u0D00-\u0D7F]/.test(text)) return "ml";
  if (/[A-Za-z]/.test(text)) return "en";
  return undefined;
}

/** Normalise model output: ASCII citation brackets, no markdown emphasis or headings. */
function cleanReply(s: string): string {
  return normalizeCitations(s)
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#+\s*/gm, "")
    .trim();
}

function dynamicContext(lead: Lead, replyLang: Lang): string {
  const uni = getUniversity(lead.universityId);
  return `CURRENT FAMILY (demo data):
- REPLY LANGUAGE for your next reply: ${LANG_NAMES[replyLang]}
- Student: ${lead.studentName}; Parent: ${lead.parentName}; City: ${lead.city}
- Preferred language: ${LANG_NAMES[lead.language]}
- Suggested university: ${uni?.name ?? "unknown"} (${uni?.city ?? ""}) - this is a DEMO university; its documents and deadline come from get_lead_status.
- Stage: ${lead.stage}; Decision: ${lead.decision}; Scholarship payment done: ${lead.scholarshipPaid ? "yes (demo)" : "no"}
- Counsellor notes: ${lead.counsellingNotes || "none"}
- Today's date: ${new Date(now()).toLocaleDateString("en-GB")}

${MODES[lead.mode ?? modeForStage(lead.stage)].playbook}`;
}

function speakerLabel(lead: Lead, role: Speaker): string {
  return role === "parent" ? `[Parent ${lead.parentName}]` : `[Student ${lead.studentName}]`;
}

export interface AgentResult {
  replies: string[];
  offerBrief: boolean;
  mode: "ai" | "mock";
  error?: string;
}

function errorText(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError || e instanceof Groq.AuthenticationError) return "API key rejected";
  if (e instanceof Anthropic.RateLimitError || e instanceof Groq.RateLimitError)
    return "Rate limited (free-tier limit reached?). Please retry in a minute.";
  if (e instanceof Anthropic.APIError) return `Claude API error ${e.status}`;
  if (e instanceof Groq.APIError) return `Groq API error ${e.status}`;
  return (e as Error).message;
}

function failed(e: unknown): AgentResult {
  return {
    replies: ["Sorry, I couldn't reply just now. Please try again in a moment."],
    offerBrief: false,
    mode: "ai",
    error: errorText(e),
  };
}

/** Handle one incoming message from a student or parent. */
export async function handleMessage(
  lead: Lead,
  role: "student" | "parent",
  text: string,
  channel: "web" | "whatsapp" = "web",
): Promise<AgentResult> {
  const t = now();
  lead.chat.push({ id: newId("m"), role, text, ts: t, channel });
  if (role === "parent") lead.parentEngaged = true;
  logEvent(lead.id, "message", { role });

  // Pick the specialist mode: what they ask about now, else where they are in the journey.
  const route = routeMode(lead, text);
  if (lead.mode !== route.mode) {
    lead.mode = route.mode;
    logEvent(lead.id, "mode_changed", { mode: route.mode, reason: route.reason });
  }

  const p = provider();
  // Each provider stores conversation history in its own format: start fresh on a switch.
  if (lead.apiProvider !== p) {
    lead.apiMessages = [];
    lead.apiProvider = p;
  }
  const replyLang = detectLang(text) ?? lead.language;
  const result =
    p === "anthropic"
      ? await runClaude(lead, role, text, replyLang)
      : p === "groq"
        ? await runGroq(lead, role, text, replyLang)
        : runMock(lead, role, text);
  result.replies = result.replies.map(cleanReply);

  // Company control: verify the reply only says what the knowledge base allows.
  if (p !== "mock" && !result.error && groundingEnabled()) {
    try {
      const check = await checkGrounded(result.replies.join("\n\n"), lead);
      if (!check.supported) {
        result.replies = [SAFE_FALLBACK[replyLang]];
        runTool(
          lead,
          "escalate_to_counsellor",
          { reason: `Question needs an approved answer: "${text.slice(0, 120)}"`, urgency: "normal" },
          {},
        );
        logEvent(lead.id, "reply_blocked", { claims: check.claims.slice(0, 3) });
      }
    } catch {
      // If the checker itself fails, fail safe: do not show an unchecked reply.
      result.replies = [SAFE_FALLBACK[replyLang]];
    }
  }

  for (const r of result.replies) lead.chat.push({ id: newId("m"), role: "agent", text: r, ts: now(), channel });
  touch(lead);
  return result;
}

const MAX_STEPS = 8;

async function runClaude(lead: Lead, role: "student" | "parent", text: string, replyLang: Lang): Promise<AgentResult> {
  const history = lead.apiMessages as MessageParam[];
  const startLen = history.length;
  history.push({ role: "user", content: `${speakerLabel(lead, role)}: ${text}` });

  const effects: ToolEffects = {};
  const replies: string[] = [];

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const res = await claude().beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        ...fallbackParams(),
        output_config: { effort: CHAT_EFFORT },
        system: [
          { type: "text", text: systemPrompt(lead), cache_control: { type: "ephemeral" } },
          { type: "text", text: dynamicContext(lead, replyLang) },
        ],
        tools: TOOLS,
        messages: history,
      });

      // Append the assistant turn unchanged (keeps thinking blocks valid).
      history.push({ role: "assistant", content: res.content });

      if (res.stop_reason === "refusal") {
        replies.push("I can't help with that here. I've asked a counsellor to get in touch with you.");
        runTool(lead, "escalate_to_counsellor", { reason: "Model declined a message", urgency: "normal" }, effects);
        break;
      }

      const said = textOf(res.content);
      if (said) replies.push(said);

      if (res.stop_reason === "pause_turn") continue;
      if (res.stop_reason !== "tool_use") break;

      const toolResults: Anthropic.Beta.Messages.BetaToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type !== "tool_use") continue;
        let output: string;
        let isError = false;
        try {
          output = runTool(lead, block.name, (block.input ?? {}) as Record<string, unknown>, effects);
        } catch (e) {
          output = `Tool failed: ${(e as Error).message}`;
          isError = true;
        }
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: output, is_error: isError });
      }
      // All results for one assistant turn go back in a single user message.
      history.push({ role: "user", content: toolResults });
    }
  } catch (e) {
    // Roll back this turn so the stored history never ends on an unanswered tool call.
    history.length = startLen;
    return failed(e);
  }

  return { replies: replies.length ? replies : ["(no reply)"], offerBrief: Boolean(effects.offerBrief), mode: "ai" };
}

// ---------------------------------------------------------------------------
// Groq (OpenAI-compatible tool calling). Same tools, same rules, same facts.
// ---------------------------------------------------------------------------
type GroqMessage = Groq.Chat.Completions.ChatCompletionMessageParam;

const GROQ_TOOLS: Groq.Chat.Completions.ChatCompletionTool[] = TOOLS.map((t) => ({
  type: "function",
  function: {
    name: t.name,
    description: t.description ?? "",
    parameters: t.input_schema as Record<string, unknown>,
  },
}));

// Free-tier token limits are tight, so only the most recent turns are sent.
const GROQ_HISTORY_LIMIT = 14;

/** Keep the last turns, always starting at a user message so tool calls stay paired. */
function trimHistory(history: GroqMessage[]): GroqMessage[] {
  if (history.length <= GROQ_HISTORY_LIMIT) return history;
  let start = history.length - GROQ_HISTORY_LIMIT;
  while (start < history.length && history[start].role !== "user") start++;
  return history.slice(start);
}

async function runGroq(lead: Lead, role: "student" | "parent", text: string, replyLang: Lang): Promise<AgentResult> {
  const history = lead.apiMessages as GroqMessage[];
  const startLen = history.length;
  history.push({ role: "user", content: `${speakerLabel(lead, role)}: ${text}` });

  const effects: ToolEffects = {};
  const replies: string[] = [];
  const system = `${systemPrompt(lead)}\n\n${dynamicContext(lead, replyLang)}`;

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      // If the main model is rate-limited (free tier), the next model in the chain answers.
      const res = await withGroqFallback(modelChain(GROQ_CHAT_MODEL), (model) =>
        groq().chat.completions.create({
          model,
          max_completion_tokens: 2000,
          ...reasoningParams(model, "medium"),
          tools: GROQ_TOOLS,
          tool_choice: "auto",
          messages: [{ role: "system", content: system }, ...trimHistory(history)],
        }),
      );
      const msg = res.choices[0]?.message;
      if (!msg) break;

      const toolCalls = msg.tool_calls ?? [];
      history.push({
        role: "assistant",
        content: msg.content ?? "",
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      });
      if (msg.content?.trim()) replies.push(msg.content.trim());
      if (!toolCalls.length) break;

      for (const call of toolCalls) {
        let output: string;
        try {
          const args = call.function.arguments ? (JSON.parse(call.function.arguments) as Record<string, unknown>) : {};
          output = runTool(lead, call.function.name, args, effects);
        } catch (e) {
          output = `Tool failed: ${(e as Error).message}`;
        }
        history.push({ role: "tool", tool_call_id: call.id, content: output });
      }
    }
  } catch (e) {
    history.length = startLen;
    return failed(e);
  }

  return { replies: replies.length ? replies : ["(no reply)"], offerBrief: Boolean(effects.offerBrief), mode: "ai" };
}

// ---------------------------------------------------------------------------
// Mock mode: runs without an API key so the app can be explored end to end.
// It uses simple keyword rules and the SAME tools, and always says it is a mock.
// ---------------------------------------------------------------------------
function runMock(lead: Lead, role: "student" | "parent", text: string): AgentResult {
  const effects: ToolEffects = {};
  const q = text.toLowerCase();
  const out: string[] = [];
  const has = (...w: string[]) => w.some((x) => q.includes(x));

  if (has("not join", "won't join", "will not join", "decided against", "not interested")) {
    runTool(lead, "record_decision", { decision: "not_joining", reason: text.slice(0, 120) }, effects);
    out.push("Thank you for letting us know. I've stopped all reminders. If anything changes, I'm here. All the best!");
  } else if (has("degree", "valid", "ugc", "aicte", "real", "university")) {
    runTool(lead, "log_objection", { type: "degree_validity", severity: "high", summary: "Asked whether the degree is valid", resolved: false }, effects);
    out.push(
      "Good question. NIAT itself is not a university [F1]. The B.Tech degree is awarded by the partner university, which is UGC-recognised or AICTE-approved [F2]. NIAT adds a separate, non-credit Industry Ready Certificate [F7]. I can also arrange a chat with a current student.",
    );
  } else if (has("fee", "cost", "loan", "emi", "money", "scholarship", "refund")) {
    runTool(lead, "log_objection", { type: "fees_and_loans", severity: "medium", summary: "Asked about total cost / loans", resolved: false }, effects);
    runTool(lead, "escalate_to_counsellor", { reason: "Family wants exact fees, scholarship and loan details", urgency: "normal" }, effects);
    out.push(
      "NIAT's public pages don't list total fees; they vary by university, and exact amounts, scholarship and refund terms must come from your counsellor in writing [F14]. I've asked your counsellor to call you with the exact breakdown.",
    );
  } else if (has("placement", "job", "salary", "package")) {
    runTool(lead, "log_objection", { type: "placements", severity: "medium", summary: "Asked about placements", resolved: false }, effects);
    out.push(
      "NIAT says 2,500+ companies have hired from NxtWave programmes, but these numbers cover several programmes and enrolling does not guarantee a job [F10]. You can talk to current NIAT students about their real experience [F12].",
    );
  } else if (has("hostel", "stay", "far", "location", "move")) {
    runTool(lead, "log_objection", { type: "hostel_and_location", severity: "medium", summary: "Worried about hostel/location", resolved: false }, effects);
    out.push("Hostel arrangements depend on each university [F13]. I can book a call so the counsellor can share the details for your campus.");
  } else if (has("scaler", "newton", "other college", "state seat", "eamcet", "jee")) {
    runTool(lead, "log_objection", { type: "competitor_or_other_option", severity: "medium", summary: "Comparing with another option", resolved: false }, effects);
    out.push("It's sensible to compare. Check for each option: who awards the degree, total 4-year cost in writing, and outcomes for one specific batch. A counsellor can go through them with you.");
  } else if (has("document", "marksheet", "certificate", "tc", "upload", "apply", "next step")) {
    out.push("You need to apply to the university separately [F3]. Upload your documents in the checklist on the right, and I'll check each one for mistakes before you submit.");
  } else if (has("join", "yes", "ready", "let's go")) {
    runTool(lead, "record_decision", { decision: "joining", reason: text.slice(0, 120) }, effects);
    out.push("That's great! The next step is the university application [F3]. Start by uploading your documents in the checklist.");
  } else {
    out.push("I'm here to help with your decision and the joining steps. You can ask about the degree, fees, placements, hostel, or the documents you need.");
  }

  return {
    replies: out.map((r) => `${r}\n\n(mock mode: add an API key for the real AI agent)`),
    offerBrief: Boolean(effects.offerBrief),
    mode: "mock",
  };
}
