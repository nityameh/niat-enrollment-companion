// The knowledge base: the ONLY things the bot may say about NIAT.
// The bot never browses the internet. NIAT's team controls what it can say from the
// Knowledge page (/admin): edit or disable answers, add company-approved answers,
// and choose whether public website facts may be used at all.
import type { AnswerMode, KnowledgeEntry } from "./types";
import type { ModeId } from "./modes";

const T0 = 0;

// Facts read from NIAT's public pages and official YouTube channel on 16-17 Nov 2026.
// Re-check before a real launch. `topics` lists the agent modes a fact is sent in
// (no topics = every mode), which keeps prompts small.
const LLM = "https://www.niatindia.com/llm-info";
const TERMS = "https://www.niatindia.com/terms-and-conditions";
const PLACEMENTS = "https://www.niatindia.com/placements";
const YT = "https://www.youtube.com/@NIATIndia.";

type Seed = Omit<KnowledgeEntry, "updatedAt" | "enabled" | "kind">;

const PUBLIC_SEED: Seed[] = [
  { id: "F1", title: "What NIAT is", answer: "NIAT (NxtWave of Innovation in Advanced Technologies) is a technology upskilling programme by NxtWave, offered at collaborating universities and institutions. NIAT itself is not a university, college or degree-awarding body.", source: LLM, questions: ["Is NIAT a university?", "What exactly is NIAT?"] },
  { id: "F2", title: "Who awards the degree", answer: "The B.Tech degree is awarded by the collaborating university, which is UGC-recognised or AICTE-approved. Admission to the university is at the university's discretion under UGC and AICTE norms.", source: "https://nxtwaveprograms.ccbp.in/niat", questions: ["Is the degree valid?", "Who gives the degree?", "Is it UGC approved?"] },
  { id: "F3", title: "Two separate applications", answer: "Applying to a university does not enrol you in NIAT, and NIAT enrolment is not university admission. Candidates must apply to their chosen university separately; the university controls its own admission.", source: LLM, questions: ["Do I need to apply to the college separately?", "Am I admitted to the university?"] },
  { id: "F4", title: "What the NAT is", answer: "The NAT (NxtWave Assessment Test) is an online test of about 90 minutes. NIAT states that NAT is not an entrance examination for any university.", source: LLM, topics: ["decision_support", "university_enrollment"] },
  { id: "F5", title: "Admission steps", answer: "Apply on the NIAT portal and pay the NAT fee, take the NAT, attend one-on-one counselling if you qualify (a collaborating university is suggested based on your preferences), then confirm NIAT enrolment. University admission is a separate process.", source: "https://www.niatindia.com/admissions", topics: ["decision_support", "university_enrollment", "niat_enrollment"] },
  { id: "F6", title: "NAT registration fee", answer: "The 2026 NAT registration fee is Rs 1,200 and it is non-refundable.", source: LLM, topics: ["fees_guidance", "university_enrollment"] },
  { id: "F7", title: "Industry Ready Certificate", answer: "NIAT gives its own Industry Ready Certificate in addition to the university degree. It is non-credit, is not a university degree, and is awarded after completing the programme and meeting minimum scores.", source: TERMS, topics: ["decision_support", "program_guidance", "niat_enrollment"] },
  { id: "F8", title: "Curriculum phases", answer: "The curriculum has four phases (Decode, Develop, Architect, Ship). The first phase covers AI essentials, no-code automation with n8n and APIs, Python, frontend development, programming, DSA, maths and aptitude.", source: "https://www.niatindia.com/", topics: ["decision_support", "program_guidance"] },
  { id: "F9", title: "Where it is offered", answer: "NIAT's campus page lists 35+ collaborating institutions (38 when checked) in Telangana, Andhra Pradesh, Karnataka, Tamil Nadu, Maharashtra, Rajasthan, Haryana, Delhi NCR, Uttar Pradesh, Madhya Pradesh and Odisha. The full list is at niatindia.com/campus.", source: "https://www.niatindia.com/campus", topics: ["college_choice", "decision_support"] },
  { id: "F10", title: "Placements (no guarantee)", answer: "NIAT says 2,500+ companies have hired NxtWave learners and cites a highest package of Rs 80 LPA, but these figures cover several NxtWave programmes (including online cohorts) and are not average or guaranteed outcomes. Enrolling in NIAT does not assure a job or internship; outcomes depend on the learner's effort, skills and performance.", source: PLACEMENTS, topics: ["decision_support", "program_guidance"], questions: ["Will I get a job?", "What are the placements?", "Is placement guaranteed?"] },
  { id: "F11", title: "IIT Kharagpur micro-specialisations", answer: "Qualifying students can earn optional IIT Kharagpur OCN micro-specialisations in generative AI. IIT Kharagpur does not issue or endorse NIAT's Industry Ready Certificate.", source: LLM, topics: ["program_guidance", "decision_support"] },
  { id: "F12", title: "Talk to current students", answer: "Prospective students can book a slot to speak with current NIAT students.", source: "https://www.niatindia.com/", topics: ["decision_support", "program_guidance", "college_choice"], questions: ["Can I talk to alumni?", "Can I speak to a current student?", "Can my son talk to someone already studying there?"] },
  { id: "F13", title: "Hostels and campus facilities", answer: "Hostels and campus facilities are provided by each university; NIAT does not own or run campuses or hostels. Availability differs by campus (for example, the Aurora Deemed University Hyderabad page lists on-campus and nearby off-campus hostels managed by the university, and transport).", source: "https://www.niatindia.com/campus/niat-hyderabad-aurora-deemed-university", topics: ["college_choice"], questions: ["Is there a hostel?", "Is the hostel safe?", "Who runs the hostel?"] },
  { id: "F14", title: "Total cost", answer: "NIAT indicates the combined university and NIAT cost at roughly Rs 8 to 18 lakh in total, depending on the university. NIAT charges its programme fee separately from the university. The exact amount, any scholarship or discount, and refund rules must come from the counsellor and university in writing.", source: LLM, topics: ["fees_guidance", "decision_support"], questions: ["What is the total cost for 4 years?", "How much will it cost overall?"] },
  { id: "F15", title: "Student clubs", answer: "Student clubs run by NIAT students include GenAI, competitive programming, drone, entrepreneurship, public speaking, media, sports and social impact clubs.", source: "https://www.niatindia.com/club", topics: ["program_guidance", "college_choice"] },
  { id: "F16", title: "Eligibility", answer: "Collaborating-institution pages list students who passed 12th between 2023 and 2027 with Mathematics, Physics and Chemistry; pre-2023 pass-outs are not eligible. Each university's own criteria can differ.", source: LLM, topics: ["university_enrollment", "decision_support"], questions: ["Am I eligible?", "I passed 12th in 2022, can I join?"] },
  { id: "F17", title: "NAT sections", answer: "The NAT has three sections: psychometric, critical thinking and learnability, and mathematics.", source: LLM, topics: ["decision_support"] },
  { id: "F18", title: "What the NIAT fee covers", answer: "The NIAT Program Fee is made up of a registration or seat-reservation fee and an upskilling fee. It does not include food, accommodation, travel or the university's academic fees, which the university collects directly. Fees are due within 15 days of the payment request unless agreed otherwise in writing.", source: TERMS, topics: ["fees_guidance", "niat_enrollment"] },
  { id: "F19", title: "Refunds", answer: "Under NIAT's terms, registration and service fees are non-refundable and non-transferable. There is no refund if the student cannot enrol in or continue the university programme. If NxtWave cancels a programme, fees are adjusted towards an alternate course rather than refunded. A student who withdraws must give 7 days' written notice.", source: TERMS, topics: ["fees_guidance", "niat_enrollment"], questions: ["Will I get my money back if I change my mind?", "Can I cancel?"] },
  { id: "F20", title: "Education loans", answer: "NxtWave may connect families with lenders, but the family is solely responsible for repaying any loan EMIs.", source: TERMS, topics: ["fees_guidance"], questions: ["Can I get an education loan?", "Is EMI available?"] },
  { id: "F21", title: "Health insurance", answer: "Students must hold health insurance of at least Rs 3 lakh for the duration of the programme.", source: TERMS, topics: ["niat_enrollment", "fees_guidance"] },
  { id: "F22", title: "Parent consent for minors", answer: "A student under 18 can enrol only with a parent's or guardian's consent, and the parent or guardian is responsible for the student following the terms.", source: TERMS, topics: ["niat_enrollment"] },
  { id: "F23", title: "Help and grievances", answer: "General help: support@niatindia.com or WhatsApp +91 8008 9009 08. Formal grievances go in writing to legal@nxtwave.co.in.", source: TERMS },
  { id: "F24", title: "Placement support offered", answer: "NxtWave provides interview and assessment preparation and connects students with recruiters, subject to its placement eligibility policy. It does not guarantee jobs, internships or apprenticeships. NIAT also cites 200+ paid internship offers to students.", source: TERMS, topics: ["program_guidance", "decision_support"] },
  { id: "F25", title: "Recent placement examples", answer: "Recent examples listed on the placements page range from about Rs 5.5 LPA to Rs 15 LPA for roles such as software engineer and data engineer; these come from learners across NxtWave programmes, including online cohorts.", source: PLACEMENTS, topics: ["program_guidance"] },
  { id: "F26", title: "Programme focus", answer: "The programme focuses on AI/ML, data science, cyber security, robotics, web development, cloud and automation through project-based learning, with a skill map NIAT says it updates every six months.", source: LLM, topics: ["program_guidance", "decision_support"] },
  { id: "F27", title: "University is independent", answer: "The collaborating university is an independent institution. NxtWave may update its list of collaborating universities, and if a university removes a student from campus, the student can no longer continue the NIAT programme and fees are not refunded.", source: TERMS, topics: ["college_choice", "fees_guidance"] },
  { id: "F28", title: "Student life", answer: "NIAT's official YouTube channel shows its 2026 orientation with students from Hyderabad, Delhi, Pune, Bengaluru, Jaipur, Bhopal and Chennai, cultural events such as Navratri celebrations, student-run startups and career-advice sessions.", source: YT, topics: ["college_choice", "program_guidance"] },
  { id: "F29", title: "Competitions", answer: "NIAT students take part in hackathons: NIAT's channel features a student who won the Rs 1,00,000 first prize at BizHack, and a NIAT Jaipur team that reached the top 5 out of 75,000+ registrations at the NxtWave x OpenAI Academy buildathon.", source: YT, topics: ["program_guidance", "decision_support"] },
];

// Example company-approved answers. In a real deployment NIAT's team writes these.
const COMPANY_SEED: Seed[] = [
  { id: "C1", title: "Talking to a counsellor", answer: "Your counsellor can call you at a time that suits you. Share a preferred time in this chat and the call will be arranged.", source: "NIAT team (demo answer)", questions: ["Can I talk to a counsellor?", "Please call me", "I want to speak to someone"] },
  { id: "C2", title: "Fees, scholarship and refunds", answer: "Exact fees, scholarship terms and refund rules are confirmed by your counsellor in writing, for your specific university. Please do not make any payment based on informal messages.", source: "NIAT team (demo answer)", questions: ["How much is the fee?", "Is the scholarship refundable?", "What is the refund policy?"] },
  { id: "C3", title: "Safe payments", answer: "Only pay through the official payment link your counsellor shares. NIAT staff will never ask for your OTP, password or bank PIN.", source: "NIAT team (demo answer)", questions: ["Someone asked for my OTP", "How do I pay safely?", "Is this payment link real?"] },
  { id: "C4", title: "University application help", answer: "After counselling, you apply to the collaborating university separately. This assistant checks each document photo for common mistakes before you submit it.", source: "NIAT team (demo answer)", questions: ["How do I apply to the university?", "What is the next step after counselling?"] },
];

export function seedKnowledge(): KnowledgeEntry[] {
  return [
    ...COMPANY_SEED.map((e) => ({ ...e, kind: "company" as const, enabled: true, updatedAt: T0 })),
    ...PUBLIC_SEED.map((e) => ({ ...e, kind: "public" as const, enabled: true, updatedAt: T0 })),
  ];
}

/**
 * Bring a saved knowledge base up to date with new seed facts: add missing entries and
 * refresh untouched ones (updatedAt 0). Anything the company edited is left alone.
 */
export function mergeSeedKnowledge(saved: KnowledgeEntry[]): KnowledgeEntry[] {
  const byId = new Map(saved.map((k) => [k.id, k]));
  for (const s of seedKnowledge()) {
    const cur = byId.get(s.id);
    if (!cur) saved.push(s);
    else if (cur.updatedAt === 0)
      Object.assign(cur, { title: s.title, answer: s.answer, source: s.source, topics: s.topics, questions: s.questions });
  }
  return saved;
}

/** Entries the bot may use right now. */
export function activeEntries(knowledge: KnowledgeEntry[], mode: AnswerMode): KnowledgeEntry[] {
  return knowledge.filter((k) => k.enabled && (mode === "company_and_public" || k.kind === "company"));
}

/**
 * The knowledge block inserted into prompts. With an agent mode, public facts are limited
 * to the ones tagged for that mode (company answers are always included).
 */
export function knowledgePrompt(knowledge: KnowledgeEntry[], mode: AnswerMode, agentMode?: ModeId): string {
  const entries = activeEntries(knowledge, mode).filter(
    (e) => e.kind === "company" || !agentMode || !e.topics?.length || e.topics.includes(agentMode),
  );
  const company = entries.filter((e) => e.kind === "company");
  const pub = entries.filter((e) => e.kind === "public");
  const fmt = (e: KnowledgeEntry) =>
    `[${e.id}] ${e.title}: ${e.answer}${e.questions?.length ? ` (families ask: ${e.questions.map((q) => `"${q}"`).join(", ")})` : ""}`;
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

// --- Matching (used by the Knowledge page's "Test a question" box) ---
const STOP = new Set(
  "a an the is are am do does did i we my our you your it its to of for in on at and or can will be with this that what how who when which there".split(" "),
);
function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((t) => t.length > 1 && !STOP.has(t));
}

/** Rank entries for a question by word overlap (questions count most, then title, then answer). */
export function matchKnowledge(entries: KnowledgeEntry[], question: string, limit = 3) {
  const q = new Set(tokens(question));
  if (!q.size) return [];
  return entries
    .map((e) => {
      const score = (text: string, weight: number) => tokens(text).filter((t) => q.has(t)).length * weight;
      const total = score((e.questions ?? []).join(" "), 3) + score(e.title, 2) + score(e.answer, 1);
      return { entry: e, score: total };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Parse "Q: ... / A: ..." blocks pasted into the bulk-add box. */
export function parseBulk(text: string): { title: string; answer: string; questions: string[] }[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => {
      const qs = [...block.matchAll(/^\s*Q\s*[:.-]\s*(.+)$/gim)].map((m) => m[1].trim());
      const a = block.match(/^\s*A\s*[:.-]\s*([\s\S]+)$/im)?.[1]?.trim() ?? "";
      return { title: qs[0] ?? "", answer: a.replace(/\s+/g, " "), questions: qs };
    })
    .filter((x) => x.title && x.answer);
}
