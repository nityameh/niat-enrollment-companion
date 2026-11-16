import "server-only";
import type { Lead } from "./types";
import { getUniversity, loadDb, now } from "./store";
import { aiEnabled, providerLabel } from "./llm";

/** Lead as sent to the browser: without the raw API history (thinking blocks etc.). */
export function publicLead(lead: Lead) {
  const { apiMessages: _omit, ...rest } = lead;
  void _omit;
  return { ...rest, university: getUniversity(lead.universityId) };
}

export function appMeta() {
  const db = loadDb();
  return { aiEnabled: aiEnabled(), provider: providerLabel(), now: now(db), clockOffsetDays: db.clockOffsetDays };
}

// --- Very small rate limiter + daily cap to protect the public demo's API budget ---
const hits = new Map<string, number[]>();
let dayKey = "";
let dayCount = 0;

export function rateLimit(req: Request, perMinute = 20): string | null {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const t = Date.now();
  const list = (hits.get(ip) ?? []).filter((x) => t - x < 60_000);
  if (list.length >= perMinute) return "Too many requests. Please wait a minute.";
  list.push(t);
  hits.set(ip, list);

  const today = new Date().toISOString().slice(0, 10);
  if (today !== dayKey) {
    dayKey = today;
    dayCount = 0;
  }
  const cap = Number(process.env.MAX_AI_CALLS_PER_DAY || 400);
  if (++dayCount > cap) return "The demo's daily AI limit is reached. Please try again tomorrow.";
  return null;
}
