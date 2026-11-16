import "server-only";
import fs from "fs";
import path from "path";
import type { AppEvent, Db, Lead, University } from "./types";
import { seedDb } from "./seed";
import { seedKnowledge } from "./knowledge";
import { computeRisk } from "./risk";

// Demo store: the whole database is one JSON document.
// - Locally it lives in .data/db.json.
// - On Vercel (no lasting disk) it lives in Redis (Upstash, via the Vercel Marketplace),
//   loaded at the start of each request (hydrate) and saved at the end (flush).
// Last write wins, which is fine for a demo; a real product would use a proper database.

const DIR =
  process.env.DATA_DIR || (process.env.VERCEL ? "/tmp/enrollment-companion" : path.join(process.cwd(), ".data"));
const FILE = path.join(DIR, "db.json");
const KEY = "enrollment-companion:db";

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const usingRedis = Boolean(REDIS_URL && REDIS_TOKEN);

let cache: Db | null = null;
let pendingWrite: Promise<void> | null = null;

export function uploadsDir(): string {
  return path.join(DIR, "uploads");
}

async function redis(command: (string | number)[]): Promise<unknown> {
  const res = await fetch(REDIS_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis error ${res.status}`);
  return ((await res.json()) as { result: unknown }).result;
}

function migrate(db: Db): Db {
  // Older saved data may predate the knowledge base.
  if (!db.knowledge) db.knowledge = seedKnowledge();
  if (!db.settings) db.settings = { answerMode: "company_and_public" };
  return db;
}

function freshDb(): Db {
  const db = seedDb();
  recomputeAll(db);
  return db;
}

/** Load the latest data for this request. Call at the start of every route and page. */
export async function hydrate(): Promise<void> {
  if (!usingRedis) {
    loadDb();
    return;
  }
  const raw = (await redis(["GET", KEY])) as string | null;
  if (raw) {
    cache = migrate(JSON.parse(raw) as Db);
  } else {
    cache = freshDb();
    persist();
  }
}

/** Wait for the save of this request's changes. Call at the end of every route. */
export async function flush(): Promise<void> {
  if (pendingWrite) {
    const p = pendingWrite;
    pendingWrite = null;
    await p;
  }
}

/** Wraps a route handler so it always sees fresh data and saves before responding. */
export function withDb<A extends unknown[], R>(handler: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  return async (...args: A) => {
    await hydrate();
    try {
      return await handler(...args);
    } finally {
      await flush();
    }
  };
}

export function loadDb(): Db {
  if (cache) return cache;
  if (usingRedis) {
    // hydrate() should have run first; fall back to a fresh demo state.
    cache = freshDb();
    return cache;
  }
  try {
    cache = migrate(JSON.parse(fs.readFileSync(FILE, "utf8")) as Db);
  } catch {
    cache = freshDb();
    persist();
  }
  return cache;
}

/** Keep the stored document small: old events and long AI histories are trimmed. */
function compact(db: Db): void {
  if (db.events.length > 600) db.events = db.events.slice(-600);
  for (const l of db.leads) {
    // Groq histories are only read as the last few turns; Claude histories must stay intact.
    if (l.apiProvider === "groq" && l.apiMessages.length > 60) {
      let start = l.apiMessages.length - 60;
      while (start < l.apiMessages.length && (l.apiMessages[start] as { role?: string }).role !== "user") start++;
      l.apiMessages = l.apiMessages.slice(start);
    }
  }
}

export function persist(): void {
  if (!cache) return;
  compact(cache);
  const json = JSON.stringify(cache);
  if (usingRedis) {
    const prev = pendingWrite;
    pendingWrite = (async () => {
      if (prev) await prev;
      await redis(["SET", KEY, json]);
    })();
    return;
  }
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(FILE, json);
}

/** Reset the demo families. The company's knowledge base and settings are kept. */
export function resetDb(): Db {
  const keep = cache ? { knowledge: cache.knowledge, settings: cache.settings } : null;
  cache = seedDb();
  if (keep?.knowledge) cache.knowledge = keep.knowledge;
  if (keep?.settings) cache.settings = keep.settings;
  recomputeAll(cache);
  persist();
  return cache;
}

/** Current time, shifted by the demo "skip days" clock. */
export function now(db: Db = loadDb()): number {
  return Date.now() + db.clockOffsetDays * 86_400_000;
}

export function getLead(id: string): Lead | undefined {
  return loadDb().leads.find((l) => l.id === id);
}

export function getUniversity(id: string): University | undefined {
  return loadDb().universities.find((u) => u.id === id);
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function logEvent(leadId: string, type: string, meta?: Record<string, unknown>): void {
  const db = loadDb();
  const ev: AppEvent = { id: newId("ev"), leadId, type, ts: now(db), meta };
  db.events.push(ev);
}

export function recomputeAll(db: Db): void {
  const t = Date.now() + db.clockOffsetDays * 86_400_000;
  for (const lead of db.leads) {
    const uni = db.universities.find((u) => u.id === lead.universityId);
    lead.risk = computeRisk(lead, uni, t);
  }
}

/** Mark activity, recompute risk and save. Call after any change to a lead. */
export function touch(lead: Lead, activity = true): void {
  const db = loadDb();
  if (activity) lead.lastActivityAt = now(db);
  const uni = db.universities.find((u) => u.id === lead.universityId);
  lead.risk = computeRisk(lead, uni, now(db));
  persist();
}
