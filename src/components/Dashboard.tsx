"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AppEvent, Lead, Stage, University } from "@/lib/types";
import { LANG_NAMES } from "@/lib/types";
import { describeEvent } from "@/lib/events";
import { MODES, modeForStage } from "@/lib/modes";
import { Avatar, Card, ModeBadge, RiskBadge, stageLabel } from "./ui";

type ClientLead = Omit<Lead, "apiMessages"> & { university?: University };
interface Data {
  leads: ClientLead[];
  objectionCounts: Record<string, number>;
  funnel: { stage: Stage; count: number }[];
  recentEvents: AppEvent[];
  metrics: Metrics;
  meta: { aiEnabled: boolean; provider: string; now: number; clockOffsetDays: number };
}

interface Metrics {
  families: number;
  enrolled: number;
  notJoining: number;
  engaged: number;
  parentsEngaged: number;
  worriesRaised: number;
  worriesResolved: number;
  docsChecked: number;
  docsFirstTimeOk: number;
  docTypes: number;
  remindersSent: number;
  handovers: number;
  blockedAnswers: number;
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

function MetricsPanel({ m }: { m: Metrics }) {
  const rows = [
    { label: "Primary: enrolled", value: `${m.enrolled} of ${m.families}`, sub: pct(m.enrolled, m.families) },
    { label: "Families who engaged", value: `${m.engaged} of ${m.families}`, sub: `parents: ${m.parentsEngaged}` },
    { label: "Worries resolved", value: `${m.worriesResolved} of ${m.worriesRaised}`, sub: pct(m.worriesResolved, m.worriesRaised) },
    { label: "Documents right first time", value: `${m.docsFirstTimeOk} of ${m.docTypes}`, sub: `${m.docsChecked} checks` },
    { label: "Reminders sent", value: String(m.remindersSent), sub: "never after a no" },
    { label: "Handed to a counsellor", value: String(m.handovers), sub: `${m.blockedAnswers} unapproved answers blocked` },
    { label: "Guardrail: not joining", value: String(m.notJoining), sub: "reminders stopped" },
  ];
  return (
    <section className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">Experiment metrics (live from this demo)</h2>
        <p className="text-[11px] text-slate-400">
          Real launch: Companion vs normal follow-up, success = +8 pts enrolled in 21 days with no rise in refunds or
          complaints
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {rows.map((r) => (
          <div key={r.label} className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500">{r.label}</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{r.value}</p>
            <p className="text-[11px] text-slate-500">{r.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [briefs, setBriefs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/dashboard", { cache: "no-store" });
    setData(await r.json());
  }

  useEffect(() => {
    let alive = true;
    const tick = () =>
      fetch("/api/dashboard", { cache: "no-store" })
        .then((r) => r.json())
        .then((j: Data) => alive && setData(j));
    tick();
    const t = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  async function callBrief(leadId: string) {
    setBusy(leadId);
    const r = await fetch("/api/callbrief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId }),
    });
    const j = await r.json();
    setBriefs((b) => ({ ...b, [leadId]: j.brief ?? j.error }));
    setBusy(null);
  }

  async function reset() {
    if (!confirm("Reset all demo families? (The knowledge base is kept.)")) return;
    await fetch("/api/reset", { method: "POST" });
    setBriefs({});
    load();
  }

  if (!data) return <p className="p-8 text-slate-400">Loading…</p>;

  const active = data.leads.filter((l) => l.stage !== "enrolled" && l.stage !== "dropped");
  const atRisk = active.filter((l) => l.risk.band === "red").length;
  const needHuman = data.leads.filter((l) => l.escalations.some((e) => !e.resolved)).length;
  const enrolled = data.leads.filter((l) => l.stage === "enrolled").length;
  const names = Object.fromEntries(data.leads.map((l) => [l.id, l.studentName]));
  const objections = Object.entries(data.objectionCounts).sort((a, b) => b[1] - a[1]);
  const maxObj = Math.max(1, ...objections.map(([, v]) => v));

  const stats = [
    { label: "Families in progress", value: active.length, tone: "text-slate-900" },
    { label: "High risk", value: atRisk, tone: "text-rose-600" },
    { label: "Need a human", value: needHuman, tone: "text-amber-600" },
    { label: "Enrolled", value: enrolled, tone: "text-emerald-600" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Counsellor dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Who needs you today, and why · demo date{" "}
            {new Date(data.meta.now).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ModeBadge ai={data.meta.aiEnabled} label={data.meta.provider} />
          <button onClick={reset} className="rounded-lg px-3 py-1.5 text-xs text-slate-500 ring-1 ring-slate-200 hover:bg-white">
            Reset demo
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className={`text-3xl font-bold ${s.tone}`}>{s.value}</p>
            <p className="mt-1 text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {data.metrics && <MetricsPanel m={data.metrics} />}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Families */}
        <div className="space-y-3">
          {data.leads.map((l) => {
            const esc = l.escalations.filter((e) => !e.resolved);
            const worries = l.objections.filter((o) => !o.resolved);
            return (
              <div
                key={l.id}
                className={`rounded-2xl border bg-white p-4 shadow-sm ${l.risk.band === "red" && l.stage !== "dropped" ? "border-rose-200" : "border-slate-200/80"}`}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <Avatar name={l.studentName} className="h-10 w-10 text-sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{l.studentName}</p>
                      <RiskBadge risk={l.risk} />
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{stageLabel(l.stage)}</span>
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">
                        {MODES[l.mode ?? modeForStage(l.stage)].icon} {MODES[l.mode ?? modeForStage(l.stage)].label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {l.parentName} · {LANG_NAMES[l.language]} · {l.city}
                    </p>
                    <p className="mt-2 text-xs text-slate-600">{l.risk.reasons.join(" · ")}</p>
                    {(worries.length > 0 || esc.length > 0) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {esc.map((e) => (
                          <span key={e.id} className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700 ring-1 ring-rose-200">
                            🙋 {e.reason}
                          </span>
                        ))}
                        {worries.map((o) => (
                          <span key={o.id} className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 ring-1 ring-amber-200">
                            {o.type.replace(/_/g, " ")}
                          </span>
                        ))}
                        {l.callBooked && (
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] text-sky-700 ring-1 ring-sky-200">📞 {l.callBooked}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => callBrief(l.id)}
                      disabled={busy === l.id}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {busy === l.id ? "Writing…" : "Prep my call"}
                    </button>
                    <Link href={`/lead/${l.id}?as=parent`} className="rounded-lg px-3 py-1.5 text-xs text-slate-600 no-underline ring-1 ring-slate-200 hover:bg-slate-50">
                      Open chat
                    </Link>
                  </div>
                </div>
                {briefs[l.id] && (
                  <p className="mt-3 whitespace-pre-wrap rounded-xl bg-indigo-50/70 p-3 text-xs leading-relaxed text-slate-800 ring-1 ring-indigo-100">
                    {briefs[l.id]}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Insights */}
        <div className="space-y-4">
          <Card title="Top worries">
            {objections.length === 0 ? (
              <p className="text-xs text-slate-500">None logged yet. Chat as a family to see worries appear.</p>
            ) : (
              <ul className="space-y-2">
                {objections.map(([k, v]) => (
                  <li key={k} className="text-xs">
                    <div className="mb-1 flex justify-between text-slate-700">
                      <span>{k.replace(/_/g, " ")}</span>
                      <b>{v}</b>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-amber-400" style={{ width: `${(v / maxObj) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Latest AI actions">
            <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {data.recentEvents
                .map((e) => ({ e, d: describeEvent(e) }))
                .filter((x) => x.d)
                .slice(0, 20)
                .map(({ e, d }) => (
                  <li key={e.id} className="flex gap-2 text-xs">
                    <span>{d!.icon}</span>
                    <span className="text-slate-700">
                      <b className="font-medium">{names[e.leadId]?.split(" ")[0]}</b> · {d!.text}
                    </span>
                  </li>
                ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
