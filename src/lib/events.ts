import type { AppEvent } from "./types";
import { MODES, type ModeId } from "./modes";

const words = (s: unknown) => String(s ?? "").replace(/_/g, " ");

/** Human-readable line for the "What the AI did" feed. Returns null for noise. */
export function describeEvent(e: AppEvent): { icon: string; text: string } | null {
  const m = e.meta ?? {};
  switch (e.type) {
    case "objection_logged":
      return { icon: "📝", text: `Noted a worry: ${words(m.type)} (${words(m.severity)})` };
    case "objection_resolved":
      return { icon: "✅", text: `Worry resolved: ${words(m.type)}` };
    case "decision":
      return m.decision === "not_joining"
        ? { icon: "🛑", text: "Family decided not to join. All reminders stopped" }
        : { icon: "🎯", text: `Decision recorded: ${words(m.decision)}` };
    case "stage":
      return { icon: "➡️", text: `Moved to stage: ${words(m.stage)}` };
    case "nudge_scheduled":
      return { icon: "⏰", text: `Planned a reminder: ${words(m.topic)}` };
    case "nudge_sent":
      return { icon: "📲", text: "Sent a WhatsApp reminder" };
    case "escalated":
      return { icon: "🙋", text: `Alerted a counsellor: ${words(m.reason)}` };
    case "call_booked":
      return { icon: "📞", text: `Counsellor call requested: ${words(m.time)}` };
    case "brief_generated":
      return { icon: "📄", text: "Wrote a Decision Brief for the family" };
    case "document_checked": {
      const issues = Array.isArray(m.issues) ? (m.issues as string[]).map(words).join(", ") : "";
      return m.status === "ok"
        ? { icon: "✅", text: `Verified ${words(m.type)}` }
        : { icon: "⚠️", text: `Flagged ${words(m.type)}: ${issues}` };
    }
    case "mode_changed": {
      const mode = MODES[m.mode as ModeId];
      return mode ? { icon: mode.icon, text: `Switched to ${mode.label} mode` } : null;
    }
    case "reply_blocked":
      return { icon: "🛡️", text: `Blocked an unapproved answer: ${Array.isArray(m.claims) ? (m.claims as string[]).join("; ") : ""}` };
    default:
      return null;
  }
}
