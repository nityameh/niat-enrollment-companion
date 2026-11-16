import { NextResponse } from "next/server";
import { getLead, withDb } from "@/lib/store";
import { handleMessage } from "@/lib/agent";
import { appMeta, publicLead, rateLimit } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

async function handlePOST(req: Request) {
  const limited = rateLimit(req);
  if (limited) return NextResponse.json({ error: limited }, { status: 429 });

  const body = (await req.json().catch(() => null)) as { leadId?: string; role?: string; text?: string } | null;
  const text = body?.text?.toString().trim().slice(0, 1500);
  const role = body?.role === "parent" ? "parent" : "student";
  const lead = body?.leadId ? getLead(body.leadId) : undefined;
  if (!lead || !text) return NextResponse.json({ error: "leadId and text are required" }, { status: 400 });

  const result = await handleMessage(lead, role, text);
  return NextResponse.json({ result, lead: publicLead(lead), meta: appMeta() });
}

export const POST = withDb(handlePOST);
