import { NextResponse } from "next/server";
import { getLead, withDb } from "@/lib/store";
import { checkDocument } from "@/lib/docs";
import { appMeta, publicLead, rateLimit } from "@/lib/api-helpers";
import type { DocType } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const DOC_TYPES: DocType[] = ["marksheet_12", "marksheet_10", "transfer_certificate"];
const TYPES = { "image/png": "image/png", "image/jpeg": "image/jpeg", "image/webp": "image/webp" } as const;
const MAX_BYTES = 4 * 1024 * 1024;

async function handlePOST(req: Request) {
  const limited = rateLimit(req, 10);
  if (limited) return NextResponse.json({ error: limited }, { status: 429 });

  const form = await req.formData();
  const lead = getLead(String(form.get("leadId") ?? ""));
  const docType = String(form.get("docType") ?? "") as DocType;
  const file = form.get("file");
  if (!lead || !DOC_TYPES.includes(docType) || !(file instanceof File)) {
    return NextResponse.json({ error: "leadId, docType and file are required" }, { status: 400 });
  }
  const mediaType = TYPES[file.type as keyof typeof TYPES];
  if (!mediaType) return NextResponse.json({ error: "Please upload a PNG, JPEG or WebP image." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 4 MB)." }, { status: 400 });

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const record = await checkDocument(lead, docType, file.name, bytes, mediaType);
    return NextResponse.json({ record, lead: publicLead(lead), meta: appMeta() });
  } catch (e) {
    return NextResponse.json({ error: `Could not check the document: ${(e as Error).message}` }, { status: 502 });
  }
}

export const POST = withDb(handlePOST);
