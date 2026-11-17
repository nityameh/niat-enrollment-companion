import Link from "next/link";
import { hydrate, loadDb, recomputeAll } from "@/lib/store";
import { LANG_NAMES } from "@/lib/types";
import { MODES } from "@/lib/modes";
import { Avatar, stageLabel } from "@/components/ui";

export const dynamic = "force-dynamic";

const BUILT = [
  {
    icon: "💬",
    title: "A WhatsApp companion for every family",
    text: "After the one-on-one counselling, parents and students can ask anything, any time, in Telugu, Hindi, Tamil, Kannada, Malayalam or English. Answers come only from NIAT-approved knowledge, with sources.",
  },
  {
    icon: "🧭",
    title: "Seven specialist modes",
    text: "The agent switches between decision support, college choice, fees, the programme, the university application, NIAT enrolment and a respectful close, based on where the family is and what they ask.",
  },
  {
    icon: "📎",
    title: "Admission paperwork, checked",
    text: "Families send photos of marksheets and certificates. The AI reads them and flags a misspelt name, a missing seal or the wrong document before the university rejects it.",
  },
  {
    icon: "🔔",
    title: "Follow-up that never nags",
    text: "If a family goes quiet for 3 days they get one useful reminder about their exact next step. A “no” stops everything.",
  },
  {
    icon: "📊",
    title: "A dashboard for counsellors",
    text: "Who is at risk of dropping, why, and what to say, so people spend their time on the families who need a person.",
  },
  {
    icon: "🛡️",
    title: "NIAT controls every answer",
    text: "The team edits what the bot may say. In “company answers only” mode a second AI blocks anything unapproved and hands it to a counsellor.",
  },
];

const TOUR = [
  { title: "Ask as a parent", text: "Open Ravi and tap “ఈ డిగ్రీ నిజమైనదేనా?” (Is this degree real?).", href: "/lead/ravi?as=parent" },
  { title: "Send a document", text: "Tap 📎 → Class 12 → “sample: name typo”. Watch it get flagged.", href: "/lead/ravi?as=parent" },
  { title: "Send a reminder", text: "Click “Send automatic reminder now” to see what a quiet family receives.", href: "/lead/ravi?as=parent" },
  { title: "Be the counsellor", text: "See risk by category, open a family, click “Prep my call”.", href: "/counsellor" },
  { title: "Control the bot", text: "Test a question, then switch to “Company answers only”.", href: "/admin" },
];

const DOT: Record<string, string> = { red: "bg-rose-500", amber: "bg-amber-500", green: "bg-emerald-500" };

export default async function Home() {
  await hydrate();
  const db = loadDb();
  recomputeAll(db);
  // Active families first (highest risk on top); enrolled and not-joining at the bottom.
  const done = (s: string) => (s === "enrolled" || s === "dropped" ? 1 : 0);
  const families = [...db.leads].sort((a, b) => done(a.stage) - done(b.stage) || b.risk.score - a.risk.score);
  const active = families.filter((l) => l.stage !== "enrolled" && l.stage !== "dropped").length;

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[290px_1fr]">
      {/* Family sidebar */}
      <aside className="lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]">
        <div className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Families after counselling</p>
            <p className="text-[11px] text-slate-500">
              {families.length} families · {active} active · sorted by risk
            </p>
          </div>
          <ul className="max-h-[240px] flex-1 overflow-y-auto p-2 lg:max-h-none">
            {families.map((l) => (
              <li key={l.id}>
                <Link href={`/lead/${l.id}?as=parent`} className="flex items-center gap-3 rounded-xl px-2 py-2 no-underline hover:bg-slate-50">
                  <Avatar name={l.studentName} className="h-8 w-8 text-[11px]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{l.parentName}</p>
                    <p className="truncate text-[11px] text-slate-500">
                      Parent of {l.studentName.split(" ")[0]} · {LANG_NAMES[l.language]} · {stageLabel(l.stage)}
                    </p>
                  </div>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[l.risk.band]}`} title={`Risk ${l.risk.score}`} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Explanation */}
      <main className="space-y-8">
        <section className="pt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">NIAT Enrollment Companion</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Keep families in the conversation from counselling to joining
          </h1>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-slate-600">
            After NIAT&apos;s one-on-one counselling, a family still has to decide, and then apply to the partner university
            separately. That is where hesitant families drop off. This companion guides them through it on WhatsApp,
            answers doubts honestly at any hour, and tells counsellors exactly who needs a person.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">What we built</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {BUILT.map((b) => (
              <div key={b.title} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <div className="text-xl">{b.icon}</div>
                <p className="mt-1 text-sm font-semibold text-slate-900">{b.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{b.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-emerald-50 p-5">
          <h2 className="text-lg font-semibold text-slate-900">How to use it (60 seconds)</h2>
          <ol className="mt-3 grid gap-3 sm:grid-cols-5">
            {TOUR.map((s, i) => (
              <li key={s.title}>
                <Link
                  href={s.href}
                  className="flex h-full flex-col rounded-2xl bg-white p-3.5 no-underline shadow-sm ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:ring-indigo-300"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{i + 1}</span>
                  <span className="mt-2 text-sm font-semibold text-slate-900">{s.title}</span>
                  <span className="mt-1 text-xs leading-relaxed text-slate-600">{s.text}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">The agent&apos;s modes</h2>
          <div className="flex flex-wrap gap-2">
            {Object.values(MODES).map((m) => (
              <span key={m.id} title={m.summary} className="rounded-full bg-white px-3 py-1 text-xs text-slate-700 ring-1 ring-slate-200">
                {m.icon} {m.label}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Families, universities and documents are synthetic. More detail on the{" "}
            <Link href="/about" className="text-indigo-600">
              About page
            </Link>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
