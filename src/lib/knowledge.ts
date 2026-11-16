// The knowledge base: the ONLY things the bot may say about NIAT.
// The bot never browses the internet. NIAT's team controls what it can say from the
// Knowledge page (/admin): edit or disable answers, add company-approved answers,
// and choose whether public website facts may be used at all.
import type { AnswerMode, KnowledgeEntry } from "./types";

const T0 = 0;

// Facts read from NIAT's public pages on 16-17 Nov 2026. Re-check before a real launch.
const PUBLIC_SEED: Omit<KnowledgeEntry, "updatedAt" | "enabled" | "kind">[] = [
  { id: "F1", title: "What NIAT is", answer: "NIAT is an upskilling programme run by NxtWave together with collaborating universities and colleges. NIAT itself is not a university or a degree-awarding body.", source: "https://www.niatindia.com/admissions" },
  { id: "F2", title: "Who awards the degree", answer: "The B.Tech degree is awarded by the collaborating university, which is UGC-recognised or AICTE-approved. Admission to the university is at the university's discretion under UGC and AICTE norms.", source: "https://nxtwaveprograms.ccbp.in/niat" },
  { id: "F3", title: "Two separate applications", answer: "Candidates must apply to their chosen university separately; the NIAT enrolment and the university admission are two different steps.", source: "https://www.niatindia.com/admissions" },
  { id: "F4", title: "What the NAT is", answer: "The NAT is a 90-minute test of cognitive abilities and potential. NIAT states that NAT is not an entrance examination for any university.", source: "https://www.niatindia.com/admissions" },
  { id: "F5", title: "Admission steps", answer: "The admissions process is: apply and pay the NAT registration fee, take the NAT, attend a one-on-one counselling session where a collaborating university is suggested, then enrol in the upskilling programme.", source: "https://www.niatindia.com/admissions" },
  { id: "F6", title: "NAT registration fee", answer: "The NAT registration fee is shown as Rs 1,200 (non-refundable) on the admissions page; some campaign pages show Rs 600.", source: "https://www.niatindia.com/admissions" },
  { id: "F7", title: "Industry Ready Certificate", answer: "NIAT issues its own Industry Ready Certificate in addition to the university degree. It is non-credit and does not affect degree progression.", source: "https://nxtwaveprograms.ccbp.in/niat" },
  { id: "F8", title: "Curriculum", answer: "The curriculum has four phases (Decode, Develop, Architect, Ship). The first phase covers AI essentials, no-code automation with n8n and APIs, Python, frontend development, programming, DSA, maths and aptitude.", source: "https://www.niatindia.com/" },
  { id: "F9", title: "Where it is offered", answer: "The programme is offered at 35+ collaborating institutions across several Indian states.", source: "https://www.niatindia.com/" },
  { id: "F10", title: "Placements (no guarantee)", answer: "NIAT says 2,500+ companies have hired from NxtWave programmes. These outcome figures cover several NxtWave programmes, and NIAT states that enrolling does not assure a job or internship.", source: "https://www.niatindia.com/" },
  { id: "F11", title: "IIT Kharagpur micro-specialisations", answer: "Optional IIT Kharagpur OCN micro-specialisations are offered. IIT Kharagpur does not award or endorse NIAT's certification.", source: "https://www.niatindia.com/" },
  { id: "F12", title: "Talk to current students", answer: "Prospective students can book a slot to speak with current NIAT students.", source: "https://www.niatindia.com/" },
  { id: "F13", title: "Hostels", answer: "Hostel accommodation depends on each university's own infrastructure.", source: "https://nxtwaveprograms.ccbp.in/niat" },
  { id: "F14", title: "Fees", answer: "NIAT's public pages do not list total programme fees; fees vary by university and city. The exact amount, scholarship terms and refund rules must come from the counsellor in writing.", source: "https://www.niatindia.com/" },
  { id: "F15", title: "Student clubs", answer: "Student clubs run by NIAT students include GenAI, competitive programming, drone, entrepreneurship, public speaking and sports clubs.", source: "https://www.niatindia.com/club" },
];

// Example company-approved answers. In a real deployment NIAT's team writes these.
const COMPANY_SEED: Omit<KnowledgeEntry, "updatedAt" | "enabled" | "kind">[] = [
  { id: "C1", title: "Talking to a counsellor", answer: "Your counsellor can call you at a time that suits you. Share a preferred time in this chat and the call will be arranged.", source: "NIAT team (demo answer)" },
  { id: "C2", title: "Fees, scholarship and refunds", answer: "Exact fees, scholarship terms and refund rules are confirmed by your counsellor in writing, for your specific university. Please do not make any payment based on informal messages.", source: "NIAT team (demo answer)" },
  { id: "C3", title: "Safe payments", answer: "Only pay through the official payment link your counsellor shares. NIAT staff will never ask for your OTP, password or bank PIN.", source: "NIAT team (demo answer)" },
  { id: "C4", title: "University application help", answer: "After counselling, you apply to the partner university separately. This assistant checks each document photo for common mistakes before you submit it.", source: "NIAT team (demo answer)" },
];

export function seedKnowledge(): KnowledgeEntry[] {
  return [
    ...COMPANY_SEED.map((e) => ({ ...e, kind: "company" as const, enabled: true, updatedAt: T0 })),
    ...PUBLIC_SEED.map((e) => ({ ...e, kind: "public" as const, enabled: true, updatedAt: T0 })),
  ];
}

/** Entries the bot may use right now. */
export function activeEntries(knowledge: KnowledgeEntry[], mode: AnswerMode): KnowledgeEntry[] {
  return knowledge.filter((k) => k.enabled && (mode === "company_and_public" || k.kind === "company"));
}

/** The knowledge block inserted into prompts. */
export function knowledgePrompt(knowledge: KnowledgeEntry[], mode: AnswerMode): string {
  const entries = activeEntries(knowledge, mode);
  const company = entries.filter((e) => e.kind === "company");
  const pub = entries.filter((e) => e.kind === "public");
  const fmt = (e: KnowledgeEntry) => `[${e.id}] ${e.title}: ${e.answer}`;
  const modeLine =
    mode === "company_only"
      ? "ANSWER MODE: COMPANY ANSWERS ONLY. You may state ONLY what is in the company-approved answers below. If a question is not covered, do not guess and do not use general knowledge: say a counsellor will answer it and use escalate_to_counsellor."
      : "ANSWER MODE: COMPANY ANSWERS + PUBLIC FACTS. Prefer company-approved answers; you may also use the public facts. Nothing else.";
  return `${modeLine}

COMPANY-APPROVED ANSWERS (written by NIAT's team; use this wording closely):
${company.length ? company.map(fmt).join("\n") : "(none)"}

PUBLIC FACTS (from NIAT's public website):
${mode === "company_only" ? "(not allowed in this mode)" : pub.length ? pub.map(fmt).join("\n") : "(none)"}`;
}

/**
 * Models write citations in many shapes: 【F2】, (F1, C2), [फ़1]. Turn them all into [F1][C2]
 * so the UI can link each one to its source.
 */
export function normalizeCitations(s: string): string {
  return s
    .replace(/[【［[]\s*([FC]\d+)\s*[】］\]]/g, "[$1]")
    .replace(/\[\s*(?:फ़|फ|ఎఫ్)\s*(\d+)\s*\]/g, "[F$1]")
    .replace(/\(\s*([FC]\d+(?:\s*[,،]\s*[FC]\d+)*)\s*\)/g, (_m, ids: string) =>
      ids
        .split(/\s*[,،]\s*/)
        .map((id) => `[${id}]`)
        .join(""),
    );
}

/** Minimal source info for the browser (to turn [F2] into a link or a tooltip). */
export type SourceMap = Record<string, { title: string; source: string; kind: "company" | "public" }>;

export function sourceMap(knowledge: KnowledgeEntry[]): SourceMap {
  return Object.fromEntries(knowledge.map((k) => [k.id, { title: k.title, source: k.source, kind: k.kind }]));
}
