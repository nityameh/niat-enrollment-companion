import type { Lead, Risk, University } from "./types";

// Simple, explainable churn-risk score. Every point comes with a reason a
// counsellor can read. Weights are guesses to be tuned against real outcomes.
const W = {
  quiet2: 10,
  quiet4: 20,
  quiet7: 35,
  highObjection: 20,
  mediumObjection: 8,
  parentNotEngaged: 10,
  docsNearDeadline: 20,
  otherOption: 15,
  openEscalation: 5,
};

const DAY = 86_400_000;

export function computeRisk(lead: Lead, uni: University | undefined, now: number): Risk {
  if (lead.stage === "enrolled") return { score: 0, band: "green", reasons: ["Enrolled"] };
  if (lead.stage === "dropped" || lead.decision === "not_joining") {
    return {
      score: 100,
      band: "red",
      reasons: [`Decided not to join${lead.decisionReason ? `: ${lead.decisionReason}` : ""}`],
    };
  }

  let score = 0;
  const reasons: string[] = [];

  const quietDays = Math.floor((now - lead.lastActivityAt) / DAY);
  if (quietDays >= 7) {
    score += W.quiet7;
    reasons.push(`No activity for ${quietDays} days`);
  } else if (quietDays >= 4) {
    score += W.quiet4;
    reasons.push(`No activity for ${quietDays} days`);
  } else if (quietDays >= 2) {
    score += W.quiet2;
    reasons.push(`No activity for ${quietDays} days`);
  }

  const open = lead.objections.filter((o) => !o.resolved);
  const high = open.filter((o) => o.severity === "high");
  const medium = open.filter((o) => o.severity === "medium");
  if (high.length) {
    score += Math.min(2, high.length) * W.highObjection;
    reasons.push(`Unresolved serious worry: ${high.map((o) => o.type.replace(/_/g, " ")).join(", ")}`);
  }
  if (medium.length) {
    score += Math.min(3, medium.length) * W.mediumObjection;
    reasons.push(`Open questions: ${medium.map((o) => o.type.replace(/_/g, " ")).join(", ")}`);
  }

  if (!lead.parentEngaged && (lead.stage === "deciding" || lead.stage === "scholarship_paid")) {
    score += W.parentNotEngaged;
    reasons.push("Parent has not engaged yet");
  }

  if (uni && (lead.stage === "applying" || lead.stage === "deciding")) {
    const deadline = lead.counselledAt + uni.applicationDeadlineDays * DAY;
    const daysLeft = Math.ceil((deadline - now) / DAY);
    const okDocs = new Set(lead.docs.filter((d) => d.status === "ok").map((d) => d.type));
    const missing = uni.requiredDocs.filter((d) => !okDocs.has(d.id));
    if (missing.length && daysLeft <= 5) {
      score += W.docsNearDeadline;
      reasons.push(
        `${missing.length} document(s) missing, ${daysLeft <= 0 ? "deadline passed" : `${daysLeft} day(s) to deadline`}`,
      );
    }
  }

  if (lead.objections.some((o) => o.type === "competitor_or_other_option" && !o.resolved)) {
    score += W.otherOption;
    reasons.push("Considering another option");
  }

  if (lead.escalations.some((e) => !e.resolved)) {
    score += W.openEscalation;
    reasons.push("Waiting for a counsellor");
  }

  score = Math.min(100, score);
  const band = score >= 60 ? "red" : score >= 30 ? "amber" : "green";
  if (!reasons.length) reasons.push("On track");
  return { score, band, reasons };
}
