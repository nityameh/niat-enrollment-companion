import { NextResponse } from "next/server";
import { loadDb, persist, recomputeAll, withDb } from "@/lib/store";
import { runDueNudges } from "@/lib/nudges";
import { appMeta, rateLimit } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

// Demo only: move the simulated clock forward, then run the reminder engine.
async function handlePOST(req: Request) {
  const limited = rateLimit(req, 6);
  if (limited) return NextResponse.json({ error: limited }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { days?: number } | null;
  const days = Math.min(7, Math.max(1, Number(body?.days ?? 3)));
  const db = loadDb();
  db.clockOffsetDays += days;
  recomputeAll(db);
  persist();
  const { sent } = await runDueNudges();
  return NextResponse.json({ skipped: days, sent, meta: appMeta() });
}

export const POST = withDb(handlePOST);
