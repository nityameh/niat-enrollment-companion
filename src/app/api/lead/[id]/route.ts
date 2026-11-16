import { NextResponse } from "next/server";
import { getLead, loadDb, withDb } from "@/lib/store";
import { appMeta, publicLead } from "@/lib/api-helpers";
import { sourceMap } from "@/lib/knowledge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = getLead(id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const db = loadDb();
  const events = db.events.filter((e) => e.leadId === id).slice(-40).reverse();
  return NextResponse.json({
    lead: publicLead(lead),
    events,
    sources: sourceMap(db.knowledge),
    answerMode: db.settings.answerMode,
    meta: appMeta(),
  });
}

export const GET = withDb(handleGET);
