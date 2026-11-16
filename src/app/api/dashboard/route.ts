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
  return NextResponse.json({ leads, objectionCounts, funnel, recentEvents, meta: appMeta() });
}

export const GET = withDb(handleGET);
