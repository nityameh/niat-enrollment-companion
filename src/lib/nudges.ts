import "server-only";
import type { Lead } from "./types";
import { LANG_NAMES } from "./types";
import { aiEnabled, textCall } from "./llm";
import { sendWhatsAppIfLinked } from "./whatsapp";
import { getUniversity, loadDb, logEvent, newId, now, persist, recomputeAll } from "./store";

const DAY = 86_400_000;

export function scheduleNudge(lead: Lead, inDays: number, topic: string, channel: "phone" | "email" = "phone"): void {
  lead.nudges.push({
    id: newId("nudge"),
    dueAt: now() + inDays * DAY,
    topic,
    channel,
    status: "pending",
  });
  logEvent(lead.id, "nudge_scheduled", { topic, inDays });
}

export function cancelNudges(lead: Lead): void {
  for (const n of lead.nudges) if (n.status === "pending") n.status = "cancelled";
}

/** Pick the most useful next step for a quiet family (used for automatic follow-ups). */
function autoTopic(lead: Lead): string | null {
  const uni = getUniversity(lead.universityId);
  const okDocs = new Set(lead.docs.filter((d) => d.status === "ok").map((d) => d.type));
  const flagged = lead.docs.filter((d) => d.status === "flagged" && !okDocs.has(d.type));
  const missing = (uni?.requiredDocs ?? []).filter((d) => !okDocs.has(d.id));
  const worry = lead.objections.find((o) => !o.resolved && o.severity !== "low");

  if (lead.stage === "applying" || lead.decision === "joining") {
    if (flagged.length) return `Fix the problem found in the ${flagged[0].type.replace(/_/g, " ")} and re-upload it`;
    if (missing.length) return `Upload the missing document: ${missing[0].label}`;
  }
  if (lead.stage === "documents_done") {
    return "All documents are verified. The last step is confirming NIAT enrolment with the first-term payment; offer a counsellor call for any final questions";
  }
  if (worry) return `Follow up on their worry about ${worry.type.replace(/_/g, " ")} and offer a counsellor call or the Decision Brief`;
  if (lead.stage === "deciding") return "Gently check in: do they have any questions about the decision? Offer the Decision Brief";
  return null;
}

/** Families who have gone quiet get one helpful automatic follow-up (never if they said no). */
function autoSchedule(lead: Lead): void {
  if (lead.arm !== "companion") return;
  if (lead.stage === "enrolled" || lead.stage === "dropped" || lead.decision === "not_joining") return;
  if (lead.nudges.some((n) => n.status === "pending")) return;
  const quietDays = (now() - lead.lastActivityAt) / DAY;
  const lastSent = Math.max(0, ...lead.nudges.filter((n) => n.sentAt).map((n) => n.sentAt as number));
  if (quietDays < 2 || now() - lastSent < 2 * DAY) return;
  const topic = autoTopic(lead);
  if (topic) scheduleNudge(lead, 0, topic);
}

async function composeText(lead: Lead, topic: string): Promise<string> {
  const uni = getUniversity(lead.universityId);
  if (!aiEnabled()) {
    return `Hi ${lead.studentName.split(" ")[0]}! Reminder from your NIAT Enrollment Companion: ${topic}. Reply here if you have any questions. (mock mode)`;
  }
  const text = await textCall({
    system:
      "You write one short, warm WhatsApp-style follow-up message (max 60 words) from the NIAT Enrollment Companion to a family. No pressure, no fake urgency, at most one emoji. Use simple everyday words. Output only the message text.",
    user: `Language: ${LANG_NAMES[lead.language]}\nStudent: ${lead.studentName}\nParent: ${lead.parentName}\nUniversity: ${uni?.name}\nStage: ${lead.stage}\nWhat this message is about: ${topic}`,
  });
  return text || topic;
}

async function deliverToN8n(lead: Lead, text: string, topic: string): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: lead.id, student: lead.studentName, language: lead.language, topic, text }),
    });
  } catch {
    // n8n is optional; the in-app phone always receives the message.
  }
}

/** Send every due reminder. Called by the n8n schedule, and by the demo "skip days" button. */
export async function runDueNudges(): Promise<{ sent: number }> {
  const db = loadDb();
  recomputeAll(db);
  for (const lead of db.leads) autoSchedule(lead);
  let sent = 0;
  const t = now();
  for (const lead of db.leads) {
    for (const n of lead.nudges) {
      if (n.status !== "pending" || n.dueAt > t) continue;
      if (lead.decision === "not_joining") {
        n.status = "cancelled";
        continue;
      }
      try {
        n.text = await composeText(lead, n.topic);
      } catch {
        n.text = `Reminder: ${n.topic}`;
      }
      n.status = "sent";
      n.sentAt = t;
      lead.phone.push({ id: newId("ph"), text: n.text, ts: t, channel: n.channel });
      lead.chat.push({ id: newId("m"), role: "agent", text: n.text, ts: t, kind: "reminder", channel: "whatsapp" });
      await sendWhatsAppIfLinked(lead, n.text);
      logEvent(lead.id, "nudge_sent", { topic: n.topic });
      await deliverToN8n(lead, n.text, n.topic);
      sent++;
    }
  }
  recomputeAll(db);
  persist();
  return { sent };
}
