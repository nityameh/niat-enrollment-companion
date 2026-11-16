import { NextResponse } from "next/server";
import { getLead, getUniversity, withDb } from "@/lib/store";
import { aiEnabled, textCall } from "@/lib/llm";
import { rateLimit } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

// AI-written call brief for the counsellor: who, why they're stuck, what to say.
async function handlePOST(req: Request) {
  const limited = rateLimit(req, 6);
  if (limited) return NextResponse.json({ error: limited }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { leadId?: string } | null;
  const lead = body?.leadId ? getLead(body.leadId) : undefined;
  if (!lead) return NextResponse.json({ error: "Unknown lead" }, { status: 404 });

  const uni = getUniversity(lead.universityId);
  const context = [
    `Student: ${lead.studentName}, parent: ${lead.parentName}, city: ${lead.city}, language: ${lead.language}`,
    `University (demo): ${uni?.name}; stage: ${lead.stage}; decision: ${lead.decision}`,
    `Risk ${lead.risk.score} (${lead.risk.band}): ${lead.risk.reasons.join("; ")}`,
    `Counsellor notes: ${lead.counsellingNotes}`,
    `Open worries: ${lead.objections.filter((o) => !o.resolved).map((o) => `${o.type}: ${o.summary}`).join("; ") || "none"}`,
    `Escalations: ${lead.escalations.filter((e) => !e.resolved).map((e) => e.reason).join("; ") || "none"}`,
    `Documents: ${lead.docs.map((d) => `${d.type}=${d.status}`).join(", ") || "none uploaded"}`,
    `Last messages: ${lead.chat.slice(-6).map((m) => `${m.role}: ${m.text}`).join(" | ")}`,
  ].join("\n");

  if (!aiEnabled()) {
    return NextResponse.json({
      brief: `(mock mode) Call ${lead.parentName} about: ${lead.risk.reasons.join("; ")}. Open worries: ${
        lead.objections.filter((o) => !o.resolved).map((o) => o.type).join(", ") || "none"
      }. Listen first, answer with facts, give the fee breakdown in writing, no pressure.`,
    });
  }

  try {
    const brief = await textCall({
      system:
        "You prepare a counsellor for a 5-minute call with a family that may not join NIAT. Use ONLY the information in the context below: do not add any claim about the programme, the university, placements, fees or quality that is not written there. Where the counsellor needs facts the context does not give (fees, placement data, hostel), tell them to bring those facts to the call. Plain text, no markdown. Max 120 words, as four short lines: Situation: ... / Worries: ... / What to say (honest, no pressure): ... / Ask: ...",
      user: context,
      maxTokens: 3000,
    });
    return NextResponse.json({ brief: brief.replace(/\*\*(.+?)\*\*/g, "$1").trim() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

export const POST = withDb(handlePOST);
