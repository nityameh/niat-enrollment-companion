import { NextResponse } from "next/server";
import { loadDb, recomputeAll, withDb } from "@/lib/store";
import { appMeta, publicLead } from "@/lib/api-helpers";
import { STAGE_ORDER } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGET() {
  const db = loadDb();
  recomputeAll(db);
  const leads = [...db.leads].sort((a, b) => b.risk.score - a.risk.score).map(publicLead);

  const objectionCounts: Record<string, number> = {};
  for (const l of db.leads) for (const o of l.objections) objectionCounts[o.type] = (objectionCounts[o.type] ?? 0) + 1;

  const funnel = [...STAGE_ORDER, "dropped" as const].map((stage) => ({
    stage,
    count: db.leads.filter((l) => l.stage === stage).length,
  }));

  const recentEvents = [...db.events].slice(-40).reverse();

  // Layer 2 metrics, computed live from this demo's own data (no invented numbers).
  const all = db.leads;
  const count = (type: string) => db.events.filter((e) => e.type === type).length;
  const objections = all.flatMap((l) => l.objections);
  // A document is "right first time" when the first upload of that type passed.
  let firstTimeOk = 0;
  let docTypes = 0;
  for (const l of all) {
    const seen = new Set<string>();
    for (const d of l.docs) {
      if (seen.has(d.type)) continue;
      seen.add(d.type);
      docTypes++;
      if (d.status === "ok") firstTimeOk++;
    }
  }
  const metrics = {
    families: all.length,
    enrolled: all.filter((l) => l.stage === "enrolled").length,
    notJoining: all.filter((l) => l.stage === "dropped").length,
    engaged: all.filter((l) => l.chat.some((m) => m.role === "student" || m.role === "parent")).length,
    parentsEngaged: all.filter((l) => l.parentEngaged).length,
    worriesRaised: objections.length,
    worriesResolved: objections.filter((o) => o.resolved).length,
    docsChecked: all.reduce((n, l) => n + l.docs.length, 0),
    docsFirstTimeOk: firstTimeOk,
    docTypes,
    remindersSent: count("nudge_sent"),
    handovers: all.reduce((n, l) => n + l.escalations.length, 0),
    blockedAnswers: count("reply_blocked"),
  };

  return NextResponse.json({ leads, objectionCounts, funnel, recentEvents, metrics, meta: appMeta() });
}

export const GET = withDb(handleGET);
