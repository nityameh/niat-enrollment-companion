import { NextResponse } from "next/server";
import { resetDb, withDb } from "@/lib/store";
import { rateLimit } from "@/lib/api-helpers";

export const runtime = "nodejs";

async function handlePOST(req: Request) {
  const limited = rateLimit(req, 3);
  if (limited) return NextResponse.json({ error: limited }, { status: 429 });
  resetDb();
  return NextResponse.json({ ok: true });
}

export const POST = withDb(handlePOST);
