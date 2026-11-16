import Link from "next/link";
import { hydrate, loadDb, recomputeAll } from "@/lib/store";
import { LANG_NAMES } from "@/lib/types";
import { Avatar, RiskBadge, stageLabel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  await hydrate();
  const db = loadDb();
  recomputeAll(db);
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16">
      {/* Hero */}
      <section className="py-12 text-center">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          From <span className="text-indigo-600">“we&apos;re not sure”</span> to{" "}
          <span className="text-emerald-600">“we&apos;ve joined”</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600">
          After NIAT counselling, families face a big decision and a separate university application. The Enrollment
          Companion supports them on WhatsApp, honestly and in their language, and tells counsellors exactly who needs
          a human.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/lead/ravi?as=parent" className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white no-underline shadow-lg shadow-slate-900/10 hover:bg-slate-700">
            Try it as a parent →
          </Link>
          <Link href="/about" className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-800 no-underline ring-1 ring-slate-200 hover:bg-slate-50">
            How it works
          </Link>
        </div>
      </section>


      {/* Families */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Step into a family&apos;s shoes</h2>
          <p className="text-xs text-slate-500">Synthetic families, after counselling</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {db.leads.map((l) => (
            <Link
              key={l.id}
              href={`/lead/${l.id}?as=parent`}
              className="group flex gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 no-underline shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
            >
              <Avatar name={l.studentName} className="h-11 w-11 text-sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{l.studentName}</p>
                    <p className="text-xs text-slate-500">
                      Parent {l.parentName} · {l.city} · {LANG_NAMES[l.language]}
                    </p>
                  </div>
                  <RiskBadge risk={l.risk} />
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-slate-600">
                  <span className="font-medium text-slate-800">{stageLabel(l.stage)}.</span> {l.counsellingNotes}
                </p>
                              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
