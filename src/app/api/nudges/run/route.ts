import { NextResponse } from "next/server";
import { withDb } from "@/lib/store";
import { runDueNudges } from "@/lib/nudges";

export const runtime = "nodejs";
export const maxDuration = 60;

// Runs the reminder engine. Called every day at 09:00 IST by Vercel Cron (see vercel.json),
// or by any scheduler such as n8n.
function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>"; n8n can send x-cron-secret.
    return req.headers.get("authorization") === `Bearer ${secret}` || req.headers.get("x-cron-secret") === secret;
  }
  // Demo without a secret: accept Vercel's cron requests only.
  return (req.headers.get("user-agent") ?? "").includes("vercel-cron");
}

async function run(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const result = await runDueNudges();
  return NextResponse.json(result);
}

export const GET = withDb(run);
export const POST = withDb(run);
