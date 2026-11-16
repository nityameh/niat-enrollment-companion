import { NextResponse } from "next/server";
import { getLead, getUniversity, withDb } from "@/lib/store";
import { handleMessage } from "@/lib/agent";
import { checkDocument } from "@/lib/docs";
import { downloadMedia, sendWhatsAppText, verifySignature, whatsappConfigured } from "@/lib/whatsapp";
import type { DocType } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Meta calls GET once to verify the webhook URL.
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (
    url.searchParams.get("hub.mode") === "subscribe" &&
    process.env.WHATSAPP_VERIFY_TOKEN &&
    url.searchParams.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

// Meta may retry deliveries; remember recent message ids so each is handled once.
const seen = new Set<string>();

interface WaMessage {
  id: string;
  from: string;
  type: string;
  text?: { body: string };
  image?: { id: string; caption?: string };
}

function guessDocType(caption: string | undefined, lead: NonNullable<ReturnType<typeof getLead>>): DocType {
  const c = (caption ?? "").toLowerCase();
  if (/\b10\b|tenth|ssc/.test(c)) return "marksheet_10";
  if (/\btc\b|transfer/.test(c)) return "transfer_certificate";
  if (/\b12\b|inter|twelfth/.test(c)) return "marksheet_12";
  // Otherwise: the first required document that is not yet verified.
  const uni = getUniversity(lead.universityId);
  const ok = new Set(lead.docs.filter((d) => d.status === "ok").map((d) => d.type));
  return uni?.requiredDocs.find((d) => !ok.has(d.id))?.id ?? "marksheet_12";
}

async function handlePOST(req: Request) {
  if (!whatsappConfigured()) return NextResponse.json({ ok: false, reason: "not configured" });
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new Response("Bad signature", { status: 401 });
  }

  const payload = JSON.parse(raw) as {
    entry?: { changes?: { value?: { messages?: WaMessage[] } }[] }[];
  };
  const messages = payload.entry?.flatMap((e) => e.changes?.flatMap((c) => c.value?.messages ?? []) ?? []) ?? [];

  // Demo: every WhatsApp sender is treated as the parent of one demo family.
  const lead = getLead(process.env.WHATSAPP_DEMO_LEAD || "ravi");
  if (!lead) return NextResponse.json({ ok: false });

  for (const m of messages) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    lead.whatsappNumber = m.from;
    try {
      if (m.type === "text" && m.text?.body) {
        const result = await handleMessage(lead, "parent", m.text.body.slice(0, 1500), "whatsapp");
        for (const r of result.replies) await sendWhatsAppText(m.from, r);
      } else if (m.type === "image" && m.image?.id) {
        const { bytes, mimeType } = await downloadMedia(m.image.id);
        const type = guessDocType(m.image.caption, lead);
        const media = (["image/png", "image/jpeg", "image/webp"].includes(mimeType) ? mimeType : "image/jpeg") as
          | "image/png"
          | "image/jpeg"
          | "image/webp";
        const record = await checkDocument(lead, type, `whatsapp_${m.image.id}.jpg`, bytes, media);
        const label = type.replace(/_/g, " ");
        await sendWhatsAppText(
          m.from,
          record.status === "ok"
            ? `Checked your ${label}: looks good.`
            : `Your ${label} needs attention:\n- ${record.issues.map((i) => i.message).join("\n- ")}`,
        );
      } else {
        await sendWhatsAppText(m.from, "Please send a text message or a clear photo of a document.");
      }
    } catch (e) {
      console.error("WhatsApp handling failed:", (e as Error).message);
    }
  }
  return NextResponse.json({ ok: true });
}

export const POST = withDb(handlePOST);
