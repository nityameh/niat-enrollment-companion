import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { Lead, ObjectionType, Stage } from "./types";
import { getUniversity, logEvent, newId, now } from "./store";
import { scheduleNudge, cancelNudges } from "./nudges";

const OBJECTION_TYPES: ObjectionType[] = [
  "degree_validity",
  "fees_and_loans",
  "placements",
  "hostel_and_location",
  "legitimacy",
  "competitor_or_other_option",
  "family_disagreement",
  "paperwork",
  "other",
];

const STAGES: Stage[] = ["deciding", "applying", "documents_done", "enrolled", "dropped"];

// All tools use strict schemas so inputs always match exactly.
export const TOOLS: Anthropic.Beta.Messages.BetaTool[] = [
  {
    name: "get_lead_status",
    description:
      "Get this family's current stage, decision, document checklist (what is verified, flagged or missing), deadline, open worries, booked calls and pending reminders. Call it before answering questions about what to do next.",
    strict: true,
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "log_objection",
    description:
      "Record a worry or objection the student or parent raised, or mark one resolved once they say the answer helped. Use one call per distinct worry.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: OBJECTION_TYPES },
        severity: { type: "string", enum: ["low", "medium", "high"] },
        summary: { type: "string", description: "One short sentence in English for the counsellor." },
        resolved: { type: "boolean" },
      },
      required: ["type", "severity", "summary", "resolved"],
      additionalProperties: false,
    },
  },
  {
    name: "record_decision",
    description:
      "Record the family's decision when they clearly state it. 'not_joining' stops all reminders: respect it and do not try to change their mind.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        decision: { type: "string", enum: ["joining", "not_joining", "undecided"] },
        reason: { type: "string" },
      },
      required: ["decision", "reason"],
      additionalProperties: false,
    },
  },
  {
    name: "update_stage",
    description: "Move the family to a new stage of the journey when it has clearly happened.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        stage: { type: "string", enum: STAGES },
        reason: { type: "string" },
      },
      required: ["stage", "reason"],
      additionalProperties: false,
    },
  },
  {
    name: "schedule_reminder",
    description:
      "Schedule a follow-up message to the family about one specific next step (for example a missing document or a question they wanted to think about). Only schedule reminders the family would find useful.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        in_days: { type: "integer", description: "Whole days from now, 0 to 14." },
        topic: { type: "string", description: "What the reminder is about, in English." },
      },
      required: ["in_days", "topic"],
      additionalProperties: false,
    },
  },
  {
    name: "escalate_to_counsellor",
    description:
      "Hand over to a human counsellor. Use for exact fees, scholarship or refund terms, payment problems, eligibility disputes, distress or anger, or when you could not answer the same question twice.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "In English, for the counsellor." },
        urgency: { type: "string", enum: ["normal", "urgent"] },
      },
      required: ["reason", "urgency"],
      additionalProperties: false,
    },
  },
  {
    name: "book_counsellor_call",
    description: "Book a call with the counsellor at a time the family prefers.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { preferred_time: { type: "string" } },
      required: ["preferred_time"],
      additionalProperties: false,
    },
  },
];

const DAY = 86_400_000;

export interface ToolEffects {
  offerBrief?: boolean;
}

/** Execute one tool call against the lead. Returns the text result for Claude. */
export function runTool(lead: Lead, name: string, input: Record<string, unknown>, effects: ToolEffects): string {
  void effects; // kept for future UI effects
  const t = now();
  switch (name) {
    case "get_lead_status": {
      const uni = getUniversity(lead.universityId);
      const deadline = uni ? lead.counselledAt + uni.applicationDeadlineDays * DAY : null;
      const checklist = (uni?.requiredDocs ?? []).map((d) => {
        const latest = [...lead.docs].reverse().find((x) => x.type === d.id);
        return {
          document: d.label,
          status: latest ? latest.status : "missing",
          issues: latest?.issues.map((i) => i.message) ?? [],
        };
      });
      return JSON.stringify({
        stage: lead.stage,
        decision: lead.decision,
        scholarship_payment_done: lead.scholarshipPaid,
        university: uni?.name,
        university_steps: uni?.steps,
        application_deadline: deadline ? new Date(deadline).toLocaleDateString("en-GB") : null,
        days_to_deadline: deadline ? Math.ceil((deadline - t) / DAY) : null,
        checklist,
        open_worries: lead.objections.filter((o) => !o.resolved).map((o) => `${o.type}: ${o.summary}`),
        call_booked: lead.callBooked ?? null,
        pending_reminders: lead.nudges.filter((n) => n.status === "pending").map((n) => n.topic),
      });
    }
    case "log_objection": {
      const type = String(input.type) as ObjectionType;
      const existing = lead.objections.find((o) => o.type === type && !o.resolved);
      if (existing && input.resolved === true) {
        existing.resolved = true;
        logEvent(lead.id, "objection_resolved", { type });
        return `Marked the ${type} worry as resolved.`;
      }
      if (existing) {
        existing.summary = String(input.summary);
        existing.severity = input.severity as "low" | "medium" | "high";
        return `Updated the existing ${type} worry.`;
      }
      lead.objections.push({
        id: newId("obj"),
        type,
        severity: input.severity as "low" | "medium" | "high",
        summary: String(input.summary),
        resolved: Boolean(input.resolved),
        ts: t,
      });
      logEvent(lead.id, "objection_logged", { type, severity: input.severity });
      return `Logged worry: ${type}.`;
    }
    case "record_decision": {
      const decision = input.decision as Lead["decision"];
      lead.decision = decision;
      lead.decisionReason = String(input.reason);
      if (decision === "not_joining") {
        lead.stage = "dropped";
        cancelNudges(lead);
      }
      if (decision === "joining" && lead.stage === "deciding") lead.stage = "applying";
      logEvent(lead.id, "decision", { decision, reason: input.reason });
      return decision === "not_joining"
        ? "Recorded. All reminders are cancelled. Thank them warmly and do not try to persuade them."
        : `Recorded decision: ${decision}.`;
    }
    case "update_stage": {
      lead.stage = input.stage as Stage;
      logEvent(lead.id, "stage", { stage: input.stage, reason: input.reason });
      return `Stage is now ${input.stage}.`;
    }
    case "schedule_reminder": {
      const days = Math.min(14, Math.max(0, Math.round(Number(input.in_days) || 0)));
      scheduleNudge(lead, days, String(input.topic));
      return `Reminder scheduled in ${days} day(s).`;
    }
    case "escalate_to_counsellor": {
      lead.escalations.push({
        id: newId("esc"),
        reason: String(input.reason),
        urgency: input.urgency as "normal" | "urgent",
        ts: t,
        resolved: false,
      });
      logEvent(lead.id, "escalated", { reason: input.reason });
      return "A counsellor has been alerted and will call back. Tell the family this honestly.";
    }
    case "book_counsellor_call": {
      lead.callBooked = String(input.preferred_time);
      logEvent(lead.id, "call_booked", { time: input.preferred_time });
      return `Call request saved for "${input.preferred_time}" (demo: the counsellor confirms the exact slot).`;
    }
    default:
      return `Unknown tool ${name}`;
  }
}
