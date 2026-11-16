import { NextResponse } from "next/server";
import { withDb } from "@/lib/store";
import { runDueNudges } from "@/lib/nudges";

export const runtime = "nodejs";
export const maxDuration = 60;

// Called on a schedule by the n8n workflow (see /n8n). Protected by a shared secret if set.
async function handlePOST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const result = await runDueNudges();
  return NextResponse.json(result);
}

export const POST = withDb(handlePOST);
