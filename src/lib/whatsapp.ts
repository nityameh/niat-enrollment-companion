import "server-only";
import crypto from "crypto";
import type { Lead } from "./types";

// Optional real WhatsApp via Meta's WhatsApp Cloud API.
// Works only when WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID are set (see README).
// Note: outside 24 hours of the family's last message, WhatsApp only allows approved
// template messages, so proactive reminders need a template in production.

const GRAPH = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";

export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

function auth(): HeadersInit {
  return { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` };
}

/** Citation markers like [F2] mean nothing on a phone; drop them. */
function forPhone(text: string): string {
  return text.replace(/\s?\[[FC]\d+\]/g, "").slice(0, 4096);
}

export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const res = await fetch(`https://graph.facebook.com/${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: forPhone(body) } }),
  });
  if (!res.ok) throw new Error(`WhatsApp send failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/** Send to the family's real WhatsApp if they have messaged the demo number before. */
export async function sendWhatsAppIfLinked(lead: Lead, text: string): Promise<void> {
  if (!whatsappConfigured() || !lead.whatsappNumber) return;
  try {
    await sendWhatsAppText(lead.whatsappNumber, text);
  } catch (e) {
    console.error((e as Error).message);
  }
}

/** Download an image the family sent (two calls: media URL, then the bytes). */
export async function downloadMedia(mediaId: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const metaRes = await fetch(`https://graph.facebook.com/${GRAPH}/${mediaId}`, { headers: auth() });
  if (!metaRes.ok) throw new Error(`Media lookup failed ${metaRes.status}`);
  const meta = (await metaRes.json()) as { url: string; mime_type: string };
  const fileRes = await fetch(meta.url, { headers: auth() });
  if (!fileRes.ok) throw new Error(`Media download failed ${fileRes.status}`);
  return { bytes: Buffer.from(await fileRes.arrayBuffer()), mimeType: meta.mime_type };
}

/** Check Meta's X-Hub-Signature-256 header when an app secret is configured. */
export function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // not configured: accept (demo only)
  if (!header) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return header.length === expected.length && crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}
