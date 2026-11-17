import Link from "next/link";
import { MODES } from "@/lib/modes";
import { providerLabel } from "@/lib/llm";

export const metadata = { title: "About · NIAT Enrollment Companion (demo)" };
export const dynamic = "force-dynamic";

function Section({ id, kicker, title, children }: { id?: string; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="border-t border-slate-200/70 py-10">
      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">{kicker}</p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
      <div className="mt-4 text-[15px] leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

const FLOW = [
  { icon: "📱", title: "Family message", text: "Parent or student on WhatsApp, any of 3 languages" },
  { icon: "🧭", title: "Mode router", text: "Picks the specialist mode from the journey stage and the question" },
  { icon: "🧠", title: "Agent + tools", text: "Answers from the knowledge base; logs worries, escalates, schedules, books calls" },
  { icon: "🛡️", title: "Grounding check", text: "A second model blocks anything the company has not approved" },
  { icon: "💬", title: "Reply", text: "Short, cited, in the family's language" },
];

const SIDE = [
  { icon: "📎", title: "Document checker", text: "Vision model reads marksheets and certificates; code flags name mismatches, missing signature/seal, wrong document." },
  { icon: "⏰", title: "Reminder engine", text: "Quiet families get one useful nudge about their exact next step. Runs on a schedule (n8n-ready). Never after a “no”." },
  { icon: "📊", title: "Risk engine", text: "Explainable churn-risk score: silence, unresolved worries, missing documents near the deadline, parent not engaged." },
  { icon: "🙋", title: "Counsellor dashboard", text: "Who needs a human today and why, with an AI-written call brief." },
];

const REAL = [
  ["AI agent with tool-calling, mode routing, grounding check", "Real, running on the configured AI model"],
  ["Document reading from photos", "Real vision model, on synthetic sample documents"],
  ["Knowledge base and answer modes", "Real and editable at /admin"],
  ["Risk score, reminders, counsellor dashboard", "Real logic; time is simulated with “Skip 3 days”"],
  ["WhatsApp", "Simulated phone; a real WhatsApp Cloud API connector is included but not tested end to end"],
  ["Families, universities, document rules, scholarship payment", "Synthetic demo data"],
];

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-20">
      <header className="py-12">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">About this project</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
          An AI companion for the moment families decide
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-600">
          Built for the NxtWave Jr. Growth Manager Growth Hack Challenge (Track B: lead to sale) by Nitya Mehta. It
          picks up where NIAT&apos;s one-on-one counselling ends and stays with the family until the student joins, or
          decides not to.
        </p>
        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          <Link href="/lead/ravi?as=parent" className="rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white no-underline hover:bg-slate-700">
            Try the demo →
          </Link>
          <a href="#how" className="rounded-xl bg-white px-4 py-2.5 font-semibold text-slate-800 no-underline ring-1 ring-slate-200 hover:bg-slate-50">
            How it works
          </a>
          <a
            href="https://github.com/nityameh/niat-enrollment-companion"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-white px-4 py-2.5 font-semibold text-slate-800 no-underline ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Source code
          </a>
        </div>
      </header>

      <Section kicker="The problem" title="After counselling, the hardest part begins">
        <p>
          Counselling ends with a suggestion, not a decision. The family still has to decide on a four-year career
          step, often with the student and parent disagreeing, and then complete a <b>separate application at the
          collaborating university</b>: NIAT counsels, the university admits. Even families who have made a scholarship
          payment can stay unsure.
        </p>
        <p className="mt-3">
          Every gap here is a place a lead goes quiet: an unanswered worry about the degree, confusion about fees, a
          marksheet with a misspelt name, a deadline nobody reminded them about. Today that follow-up depends on
          counsellors&apos; time, which is the human bottleneck in an AI-native opportunity.
        </p>
      </Section>

      <Section kicker="The idea" title="One honest guide per family, in their language">
        <p>
          The Companion is an AI agent on WhatsApp that answers worries honestly, works through the paperwork with the
          family, follows up at the right moment, and hands over to a counsellor with context when a human is
          needed. It is built to win trust rather than to pressure: it says plainly that NIAT is not a university,
          never invents fees or guarantees, and stops all messages the moment a family says no.
        </p>
      </Section>

      <Section id="how" kicker="How it works" title="The system">
        <div className="flex flex-col gap-2 sm:flex-row">
          {FLOW.map((f, i) => (
            <div key={f.title} className="flex flex-1 items-center gap-2 sm:flex-col sm:items-stretch">
              <div className="flex-1 rounded-2xl border border-slate-200/80 bg-white p-3 text-center shadow-sm">
                <div className="text-xl">{f.icon}</div>
                <p className="mt-1 text-xs font-semibold text-slate-900">{f.title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{f.text}</p>
              </div>
              {i < FLOW.length - 1 && <span className="text-center text-slate-300 sm:hidden">↓</span>}
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {SIDE.map((s) => (
            <div key={s.title} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">
                {s.icon} {s.title}
              </p>
              <p className="mt-1 text-sm text-slate-600">{s.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section kicker="Agent modes" title="Seven specialists, one conversation">
        <p className="mb-4">
          The agent switches mode based on where the family is in the journey and what they are asking right now. Each
          mode has its own playbook and its own suggested replies.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.values(MODES).map((m) => (
            <div key={m.id} className="flex gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
              <span className="text-xl">{m.icon}</span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{m.label}</p>
                <p className="text-xs text-slate-600">{m.summary}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section kicker="Company control" title="The bot only says what NIAT approves">
        <p>
          The bot never searches the internet. It answers only from a knowledge base NIAT&apos;s team controls at{" "}
          <Link href="/admin">/admin</Link>: company-approved answers, plus (optionally) verified facts from NIAT&apos;s
          public website, each with its source. In “company answers only” mode a second, independent model checks
          every reply before the family sees it; anything unapproved is replaced with “your counsellor will answer
          this”, and a counsellor is alerted.
        </p>
      </Section>

      <Section kicker="Measurement" title="How we would know it works">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <b>Primary metric:</b> share of counselled families who complete enrolment within 21 days.
          </li>
          <li>
            <b>Secondary:</b> time to enrol, worries resolved, documents completed first time, counsellor minutes per
            enrolment.
          </li>
          <li>
            <b>Guardrails:</b> refund requests, complaints, opt-outs, and drop-outs in the first 30 days after joining
            (proof the agent is not pushing the wrong students).
          </li>
          <li>
            <b>First experiment:</b> 3 weeks, counselled leads alternated between the normal process and the
            Companion. It is a go/no-go signal for a larger test, not proof.
          </li>
        </ul>
      </Section>

      <Section kicker="Honesty" title="What is real and what is simulated">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
          {REAL.map(([what, status], i) => (
            <div key={what} className={`grid grid-cols-[1fr_1fr] gap-3 px-4 py-2.5 text-sm ${i ? "border-t border-slate-100" : ""}`}>
              <span className="text-slate-800">{what}</span>
              <span className="text-slate-500">{status}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">Currently running on: {providerLabel()}.</p>
      </Section>

      <Section kicker="Built with" title="Stack">
        <p>
          Next.js and TypeScript; an AI provider layer that runs on Groq (gpt-oss-120b for the agent, Qwen for
          document photos, gpt-oss-20b for reminders and checks) or Claude, switchable by one setting; custom
          tool-calling agent; JSON schema outputs; scheduled reminders ready for n8n; WhatsApp Cloud API connector.
        </p>
      </Section>

      <Section kicker="Next" title="If this were going live">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Real WhatsApp number with approved message templates for reminders.</li>
          <li>Connect to NIAT&apos;s CRM and each collaborating university&apos;s real document list and deadlines.</li>
          <li>Staff login and audit log for the knowledge base; native-speaker review of every language.</li>
          <li>Voice notes in Telugu and Hindi for parents who prefer speaking to typing.</li>
        </ul>
      </Section>
    </main>
  );
}
