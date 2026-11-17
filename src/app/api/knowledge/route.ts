import { NextResponse } from "next/server";
import { loadDb, persist, withDb } from "@/lib/store";
import { rateLimit } from "@/lib/api-helpers";
import type { AnswerMode, KnowledgeEntry } from "@/lib/types";
import { parseBulk, seedKnowledge } from "@/lib/knowledge";
import { checkFactsAgainstSite } from "@/lib/refresh";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Demo admin API for the company's knowledge base. A real deployment needs login and roles.

async function handleGET() {
  const db = loadDb();
  return NextResponse.json({ knowledge: db.knowledge, settings: db.settings });
}

type Body =
  | { action: "setMode"; mode: AnswerMode }
  | { action: "upsert"; entry: Pick<KnowledgeEntry, "title" | "answer" | "source"> & { id?: string; questions?: string[] } }
  | { action: "bulkAdd"; text: string }
  | { action: "toggle"; id: string }
  | { action: "delete"; id: string }
  | { action: "restoreDefaults" }
  | { action: "checkSite" };

async function handlePOST(req: Request) {
  const limited = rateLimit(req, 30);
  if (limited) return NextResponse.json({ error: limited }, { status: 429 });
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const db = loadDb();
  const t = Date.now();

  switch (body.action) {
    case "setMode":
      if (body.mode !== "company_only" && body.mode !== "company_and_public") {
        return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
      }
      db.settings.answerMode = body.mode;
      break;

    case "upsert": {
      const title = body.entry.title?.trim().slice(0, 120);
      const answer = body.entry.answer?.trim().slice(0, 1500);
      const source = body.entry.source?.trim().slice(0, 300) || "NIAT team";
      const questions = (body.entry.questions ?? []).map((q) => q.trim().slice(0, 200)).filter(Boolean).slice(0, 12);
      if (!title || !answer) return NextResponse.json({ error: "Title and answer are required" }, { status: 400 });
      const existing = body.entry.id ? db.knowledge.find((k) => k.id === body.entry.id) : undefined;
      if (existing) {
        Object.assign(existing, { title, answer, source, questions, updatedAt: t });
      } else {
        const next = 1 + Math.max(0, ...db.knowledge.filter((k) => k.kind === "company").map((k) => Number(k.id.slice(1)) || 0));
        db.knowledge.unshift({ id: `C${next}`, kind: "company", title, answer, source, questions, enabled: true, updatedAt: t });
      }
      break;
    }

    case "toggle": {
      const k = db.knowledge.find((x) => x.id === body.id);
      if (!k) return NextResponse.json({ error: "Not found" }, { status: 404 });
      k.enabled = !k.enabled;
      k.updatedAt = t;
      break;
    }

    case "delete": {
      const i = db.knowledge.findIndex((x) => x.id === body.id && x.kind === "company");
      if (i < 0) return NextResponse.json({ error: "Only company answers can be deleted (disable public facts instead)" }, { status: 400 });
      db.knowledge.splice(i, 1);
      break;
    }

    case "bulkAdd": {
      const items = parseBulk(String(body.text ?? "")).slice(0, 30);
      if (!items.length) return NextResponse.json({ error: "No Q:/A: pairs found" }, { status: 400 });
      let next = 1 + Math.max(0, ...db.knowledge.filter((k) => k.kind === "company").map((k) => Number(k.id.slice(1)) || 0));
      for (const it of items) {
        db.knowledge.unshift({
          id: `C${next++}`,
          kind: "company",
          title: it.title.slice(0, 120),
          answer: it.answer.slice(0, 1500),
          source: "NIAT team",
          questions: it.questions.slice(0, 12),
          enabled: true,
          updatedAt: t,
        });
      }
      break;
    }

    case "restoreDefaults":
      db.knowledge = seedKnowledge();
      db.settings.answerMode = "company_and_public";
      break;

    case "checkSite":
      try {
        db.settings.lastRefresh = await checkFactsAgainstSite(db.knowledge);
      } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 502 });
      }
      break;

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  persist();
  return NextResponse.json({ knowledge: db.knowledge, settings: db.settings });
}

export const GET = withDb(handleGET);

export const POST = withDb(handlePOST);
