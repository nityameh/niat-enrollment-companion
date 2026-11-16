import Link from "next/link";
import { getLead, getUniversity, hydrate, loadDb } from "@/lib/store";
import { Cited } from "@/components/Cited";
import { sourceMap, type SourceMap } from "@/lib/knowledge";

export const dynamic = "force-dynamic";

function List({ title, items, sources }: { title: string; items: string[]; sources: SourceMap }) {
  return (
    <section className="mb-5">
      <h2 className="mb-1 text-base font-semibold text-slate-900">{title}</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
        {items.map((x, i) => (
          <li key={i}>
            <Cited text={x} sources={sources} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await hydrate();
  const lead = getLead(id);
  const brief = lead?.brief;
  if (!lead || !brief) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>No Decision Brief yet.</p>
        <Link href={`/lead/${id}`} className="text-indigo-700 underline">
          Back
        </Link>
      </main>
    );
  }
  const uni = getUniversity(lead.universityId);
  const knowledge = loadDb().knowledge;
  const sources = sourceMap(knowledge);
  // Every fact id cited anywhere in the brief, plus each concern's declared sources.
  const allText = JSON.stringify(brief);
  const used = new Set([
    ...brief.concerns.flatMap((c) => c.source_ids),
    ...Array.from(allText.matchAll(/\[([FC]\d+)\]/g), (m) => m[1]),
  ]);

  return (
    <main className="mx-auto max-w-2xl bg-white px-6 py-8 print:px-0">
      <p className="text-xs text-slate-500">
        Decision Brief for {lead.studentName} & {lead.parentName} · {uni?.name} ·{" "}
        {new Date(brief.generatedAt).toDateString()} · {brief.mode === "ai" ? "written by AI from NIAT's approved knowledge" : "mock template"}
      </p>
      <h1 className="mb-2 mt-1 text-2xl font-bold text-slate-900">{brief.headline}</h1>
      <p className="mb-5 text-sm text-slate-700">{brief.summary}</p>

      <section className="mb-5 rounded-lg bg-slate-50 p-3 text-sm text-slate-800">
        <h2 className="mb-1 font-semibold">What NIAT is</h2>
        <Cited text={brief.what_niat_is} sources={sources} />
      </section>

      <List title="What looks strong" items={brief.strengths} sources={sources} />

      <section className="mb-5">
        <h2 className="mb-2 text-base font-semibold text-slate-900">Your worries, answered honestly</h2>
        <div className="space-y-2">
          {brief.concerns.map((c, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="font-semibold text-slate-900">{c.concern}</p>
              <p className="text-slate-800">
                <Cited text={c.honest_answer} sources={sources} />{" "}
                {c.source_ids
                  .filter((s) => !c.honest_answer.includes(`[${s}]`))
                  .map((s) => (
                    <Cited key={s} text={`[${s}]`} sources={sources} />
                  ))}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <h2 className="mb-1 font-semibold">About money</h2>
        <Cited text={brief.money_note} sources={sources} />
      </section>

      <List title="Check these yourself" items={brief.what_to_verify} sources={sources} />
      <List title="Questions to ask the counsellor" items={brief.questions_to_ask} sources={sources} />
      <List title="Next steps" items={brief.next_steps} sources={sources} />

      <footer className="mt-8 border-t border-slate-200 pt-3 text-xs text-slate-500">
        <p className="mb-1">Sources used:</p>
        <ul className="space-y-0.5">
          {knowledge
            .filter((k) => used.has(k.id))
            .map((k) => (
              <li key={k.id}>
                [{k.id}] {k.title}:{" "}
                {k.kind === "public" ? (
                  <a href={k.source} className="underline">
                    {k.source}
                  </a>
                ) : (
                  <span>{k.source}</span>
                )}
              </li>
            ))}
        </ul>
        <p className="mt-2">Demo only. Synthetic family and university. Confirm every fee and rule in writing with NIAT and the university.</p>
      </footer>
    </main>
  );
}
