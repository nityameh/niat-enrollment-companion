import { NextResponse } from "next/server";
import { getLead, withDb } from "@/lib/store";
import { generateBrief } from "@/lib/brief";
import { rateLimit } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

async function handlePOST(req: Request) {
  const limited = rateLimit(req, 5);
  if (limited) return NextResponse.json({ error: limited }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { leadId?: string } | null;
  const lead = body?.leadId ? getLead(body.leadId) : undefined;
  if (!lead) return NextResponse.json({ error: "Unknown lead" }, { status: 404 });
  try {
    const brief = await generateBrief(lead);
    return NextResponse.json({ brief });
  } catch (e) {
    return NextResponse.json({ error: `Could not generate the brief: ${(e as Error).message}` }, { status: 502 });
  }
}

export const POST = withDb(handlePOST);
