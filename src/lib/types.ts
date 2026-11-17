// Domain types for the Enrollment Companion.
import type { ModeId } from "./modes";
// Everything here is demo data; nothing represents a real student or a real university rule.

export type Lang = "en" | "te" | "hi" | "ta" | "kn" | "ml";

export const LANG_NAMES: Record<Lang, string> = {
  en: "English",
  te: "Telugu",
  hi: "Hindi",
  ta: "Tamil",
  kn: "Kannada",
  ml: "Malayalam",
};

export type Stage =
  | "counselled"
  | "scholarship_paid"
  | "deciding"
  | "applying"
  | "documents_done"
  | "enrolled"
  | "dropped";

export const STAGE_ORDER: Stage[] = [
  "counselled",
  "deciding",
  "applying",
  "documents_done",
  "enrolled",
];

export type DocType = "marksheet_12" | "marksheet_10" | "transfer_certificate";

export interface University {
  id: string;
  name: string;
  city: string;
  demo: true;
  requiredDocs: { id: DocType; label: string }[];
  applicationDeadlineDays: number; // days after counselling
  minClass12Percent: number; // demo threshold, not a real rule
  steps: string[];
}

export type Speaker = "student" | "parent" | "agent" | "counsellor" | "system";

export interface ChatMsg {
  id: string;
  role: Speaker;
  text: string;
  ts: number;
  /** "reminder" = proactive message sent by the reminder engine; "brief" = Decision Brief card. */
  kind?: "reminder" | "brief" | "document";
  channel?: "web" | "whatsapp";
}

export type ObjectionType =
  | "degree_validity"
  | "fees_and_loans"
  | "placements"
  | "hostel_and_location"
  | "legitimacy"
  | "competitor_or_other_option"
  | "family_disagreement"
  | "paperwork"
  | "other";

export interface Objection {
  id: string;
  type: ObjectionType;
  severity: "low" | "medium" | "high";
  summary: string;
  resolved: boolean;
  ts: number;
}

export interface DocIssue {
  code: string;
  message: string;
}

export interface DocRecord {
  id: string;
  type: DocType;
  fileName: string;
  status: "ok" | "flagged";
  issues: DocIssue[];
  extracted: Record<string, unknown>;
  ts: number;
  mode: "ai" | "mock";
}

export interface Nudge {
  id: string;
  dueAt: number;
  topic: string;
  channel: "phone" | "email";
  status: "pending" | "sent" | "cancelled";
  text?: string;
  sentAt?: number;
}

export interface Escalation {
  id: string;
  reason: string;
  urgency: "normal" | "urgent";
  ts: number;
  resolved: boolean;
}

export interface PhoneMsg {
  id: string;
  text: string;
  ts: number;
  channel: "phone" | "email";
}

export interface DecisionBrief {
  generatedAt: number;
  mode: "ai" | "mock";
  language: Lang;
  headline: string;
  summary: string;
  what_niat_is: string;
  strengths: string[];
  concerns: { concern: string; honest_answer: string; source_ids: string[] }[];
  money_note: string;
  what_to_verify: string[];
  questions_to_ask: string[];
  next_steps: string[];
}

export interface Risk {
  score: number;
  band: "green" | "amber" | "red";
  reasons: string[];
}

export interface Lead {
  id: string;
  studentName: string;
  parentName: string;
  language: Lang;
  city: string;
  universityId: string;
  stage: Stage;
  scholarshipPaid: boolean;
  counselledAt: number;
  counsellingNotes: string;
  lastActivityAt: number;
  decision: "undecided" | "joining" | "not_joining";
  decisionReason?: string;
  arm: "companion" | "control";
  parentEngaged: boolean;
  callBooked?: string;
  mode?: ModeId; // which specialist mode the agent is in
  whatsappNumber?: string; // set when the family messages the real WhatsApp demo number
  chat: ChatMsg[];
  apiMessages: unknown[]; // raw provider history, appended unchanged
  apiProvider?: string; // which provider wrote apiMessages
  objections: Objection[];
  docs: DocRecord[];
  nudges: Nudge[];
  escalations: Escalation[];
  phone: PhoneMsg[];
  brief?: DecisionBrief;
  risk: Risk;
}

export interface AppEvent {
  id: string;
  leadId: string;
  type: string;
  ts: number;
  meta?: Record<string, unknown>;
}

/**
 * One answer the bot is allowed to use.
 * - "company": written/approved by NIAT's team in the Knowledge page.
 * - "public": a fact taken from NIAT's public website (with its URL).
 * The bot never browses the internet; it only uses enabled entries.
 */
export interface KnowledgeEntry {
  id: string; // C1, C2... for company answers, F1, F2... for public facts
  kind: "company" | "public";
  title: string;
  answer: string;
  source: string; // URL for public facts, "NIAT team" etc. for company answers
  topics?: ModeId[]; // agent modes this entry is used in (none = all)
  questions?: string[]; // ways families ask this, to help match paraphrases
  enabled: boolean;
  updatedAt: number;
}

/** company_only: answer ONLY from company-approved answers. company_and_public: also use public facts. */
export type AnswerMode = "company_only" | "company_and_public";

export interface Settings {
  answerMode: AnswerMode;
  /** Last check of public facts against NIAT's live site. */
  lastRefresh?: import("./refresh").RefreshResult;
}

export interface Db {
  version: 1;
  clockOffsetDays: number;
  universities: University[];
  leads: Lead[];
  events: AppEvent[];
  knowledge: KnowledgeEntry[];
  settings: Settings;
}
