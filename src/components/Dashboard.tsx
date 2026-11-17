"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AppEvent, Lead, Stage, University } from "@/lib/types";
import { LANG_NAMES, STAGE_ORDER } from "@/lib/types";
import { describeEvent } from "@/lib/events";
import { MODES, modeForStage, type ModeId } from "@/lib/modes";
import { Avatar, Card, ModeBadge, RiskBadge, stageLabel } from "./ui";

type ClientLead = Omit<Lead, "apiMessages"> & { university?: University };

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

interface Data {
  leads: ClientLead[];
  objectionCounts: Record<string, number>;
  recentEvents: AppEvent[];
  metrics: Metrics;
  meta: { aiEnabled: boolean; provider: string; now: number; clockOffsetDays: number };
}

type Filter = "all" | "high" | "human" | "active" | "enrolled" | "dropped";
const FILTERS: { id: Filter; label: string; test: (l: ClientLead) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "high", label: "High risk", test: (l) => l.risk.band === "red" && l.stage !== "dropped" },
  { id: "human", label: "Needs a human", test: (l) => l.escalations.some((e) => !e.resolved) },
  { id: "active", label: "In progress", test: (l) => l.stage !== "enrolled" && l.stage !== "dropped" },
  { id: "enrolled", label: "Enrolled", test: (l) => l.stage === "enrolled" },
  { id: "dropped", label: "Not joining", test: (l) => l.stage === "dropped" },
];

const words = (s: string) => s.replace(/_/g, " ");
const modeOf = (l: ClientLead): ModeId => l.mode ?? modeForStage(l.stage);
const DOT: Record<string, string> = { red: "bg-rose-500", amber: "bg-amber-500", green: "bg-emerald-500" };

/** Thin horizontal bars: one hue, value labelled at the end, hover highlight + tooltip. */
function Bars({ rows, color = "bg-indigo-500" }: { rows: { label: string; value: number; color?: string }[]; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li
          key={r.label}
          className="group grid grid-cols-[120px_1fr_24px] items-center gap-2 rounded-md px-1 py-0.5 hover:bg-slate-50"
          title={`${r.label}: ${r.value}`}
        >
          <span className="truncate text-xs text-slate-600">{r.label}</span>
          <span className="h-2.5 rounded-full bg-slate-100">
            <span
              className={`block h-2.5 rounded-full ${r.color ?? color} transition group-hover:brightness-110`}
              style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value ? 6 : 0 }}
            />
          </span>
          <span className="text-right text-xs font-semibold text-slate-800">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

function ImpactCalculator() {
  const [counselled, setCounselled] = useState(1000);
  const [churn, setChurn] = useState(40);
  const [reduction, setReduction] = useState(6);
  const [leadRate, setLeadRate] = useState(4);
  const [cpl, setCpl] = useState(500);
  const extra = Math.round((counselled * reduction) / 100);
  const leadsNeeded = leadRate > 0 ? Math.round(extra / (leadRate / 100)) : 0;
  const spend = leadsNeeded * cpl;
  const field = (label: string, value: number, set: (n: number) => void, suffix = "") => (
    <label className="text-xs text-slate-600">
      {label}
      <span className="mt-1 flex items-center gap-1">
        <input
          type="number"
          value={value}
          min={0}
          onChange={(e) => set(Number(e.target.value) || 0)}
          className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-900 outline-none focus:border-indigo-400"
        />
        {suffix && <span className="text-slate-400">{suffix}</span>}
      </span>
    </label>
  );
  return (
    <Card title="Growth impact calculator" right={<span className="text-[11px] text-slate-400">assumptions you can change</span>}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {field("Counselled families / month", counselled, setCounselled)}
        {field("Churn after counselling", churn, setChurn, "%")}
        {field("Churn reduction", reduction, setReduction, "pts")}
        {field("New lead → enrolment", leadRate, setLeadRate, "%")}
        {field("Cost per new lead", cpl, setCpl, "₹")}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-emerald-50 p-3">
          <p className="text-2xl font-bold text-emerald-700">+{extra}</p>
          <p className="text-xs text-emerald-800">
            extra enrolments a month (churn {churn}% → {Math.max(0, churn - reduction)}%)
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-2xl font-bold text-slate-900">{leadsNeeded.toLocaleString("en-IN")}</p>
          <p className="text-xs text-slate-600">new leads you would otherwise need to buy</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-2xl font-bold text-slate-900">₹{(spend / 100000).toFixed(1)} lakh</p>
          <p className="text-xs text-slate-600">acquisition spend those enrolments would cost</p>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">Default values are assumptions, not NIAT data. Replace them with real numbers.</p>
    </Card>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);
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
    const t = setInterval(tick, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const charts = useMemo(() => {
    if (!data) return null;
    const L = data.leads;
    const count = <K extends string>(keys: K[], key: (l: ClientLead) => K) => keys.map((k) => ({ k, n: L.filter((l) => key(l) === k).length }));
    return {
      risk: [
        { label: "High risk", value: L.filter((l) => l.risk.band === "red" && l.stage !== "dropped").length, color: "bg-rose-500" },
        { label: "Medium risk", value: L.filter((l) => l.risk.band === "amber").length, color: "bg-amber-500" },
        { label: "Low risk", value: L.filter((l) => l.risk.band === "green").length, color: "bg-emerald-500" },
      ],
      stage: count([...STAGE_ORDER, "dropped"] as Stage[], (l) => l.stage).map(({ k, n }) => ({ label: stageLabel(k), value: n })),
      mode: count(Object.keys(MODES) as ModeId[], modeOf).map(({ k, n }) => ({ label: `${MODES[k].icon} ${MODES[k].label}`, value: n })),
      worries: Object.entries(data.objectionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([k, v]) => ({ label: words(k), value: v })),
      language: count(Object.keys(LANG_NAMES) as (keyof typeof LANG_NAMES)[], (l) => l.language)
        .filter((x) => x.n)
        .map(({ k, n }) => ({ label: LANG_NAMES[k], value: n })),
    };
  }, [data]);

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
    setSelected(null);
    load();
  }

  if (!data || !charts) return <p className="p-8 text-slate-400">Loading…</p>;

  const done = (s: string) => (s === "enrolled" || s === "dropped" ? 1 : 0);
  const sorted = [...data.leads].sort((a, b) => done(a.stage) - done(b.stage) || b.risk.score - a.risk.score);
  const list = sorted.filter(FILTERS.find((f) => f.id === filter)!.test);
  const current = data.leads.find((l) => l.id === selected) ?? null;
  const m = data.metrics;
  const names = Object.fromEntries(data.leads.map((l) => [l.id, l.studentName]));
  const active = data.leads.filter((l) => l.stage !== "enrolled" && l.stage !== "dropped").length;
  const stats = [
    { label: "Families in progress", value: active, tone: "text-slate-900" },
    { label: "High risk", value: charts.risk[0].value, tone: "text-rose-600" },
    { label: "Need a human", value: data.leads.filter((l) => l.escalations.some((e) => !e.resolved)).length, tone: "text-amber-600" },
    { label: "Enrolled", value: m.enrolled, tone: "text-emerald-600" },
  ];

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[300px_1fr]">
      {/* Family sidebar */}
      <aside className="lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]">
        <div className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-3">
            <p className="text-sm font-semibold text-slate-900">Students & parents</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`rounded-full px-2 py-0.5 text-[11px] ${filter === f.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {f.label} {data.leads.filter(f.test).length}
                </button>
              ))}
            </div>
          </div>
          <ul className="max-h-[240px] flex-1 overflow-y-auto p-2 lg:max-h-none">
            {list.map((l) => (
              <li key={l.id}>
                <button
                  onClick={() => setSelected(l.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left ${selected === l.id ? "bg-indigo-50 ring-1 ring-indigo-200" : "hover:bg-slate-50"}`}
                >
                  <Avatar name={l.studentName} className="h-8 w-8 text-[11px]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{l.studentName}</p>
                    <p className="truncate text-[11px] text-slate-500">
                      {l.parentName} · {MODES[modeOf(l)].icon} {MODES[modeOf(l)].label}
                    </p>
                  </div>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[l.risk.band]}`} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
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

        {current ? (
          <section className="rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start gap-3">
              <Avatar name={current.studentName} className="h-10 w-10 text-sm" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900">{current.studentName}</p>
                  <RiskBadge risk={current.risk} />
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{stageLabel(current.stage)}</span>
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">
                    {MODES[modeOf(current)].icon} {MODES[modeOf(current)].label}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Parent {current.parentName} · {LANG_NAMES[current.language]} · {current.city}
                </p>
                <p className="mt-2 text-xs text-slate-700">{current.counsellingNotes}</p>
                <p className="mt-1 text-xs text-slate-500">Why: {current.risk.reasons.join(" · ")}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {current.escalations
                    .filter((e) => !e.resolved)
                    .map((e) => (
                      <span key={e.id} className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700 ring-1 ring-rose-200">
                        🙋 {e.reason}
                      </span>
                    ))}
                  {current.objections
                    .filter((o) => !o.resolved)
                    .map((o) => (
                      <span key={o.id} className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 ring-1 ring-amber-200">
                        {words(o.type)}
                      </span>
                    ))}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => callBrief(current.id)}
                  disabled={busy === current.id}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {busy === current.id ? "Writing…" : "Prep my call"}
                </button>
                <Link
                  href={`/lead/${current.id}?as=parent`}
                  className="rounded-lg px-3 py-1.5 text-xs text-slate-600 no-underline ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  Open chat
                </Link>
              </div>
            </div>
            {briefs[current.id] && (
              <p className="mt-3 whitespace-pre-wrap rounded-xl bg-indigo-50/70 p-3 text-xs leading-relaxed text-slate-800">{briefs[current.id]}</p>
            )}
          </section>
        ) : (
          <p className="text-xs text-slate-500">Select a family on the left to see why they are at risk and prepare a call.</p>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <p className={`text-3xl font-bold ${s.tone}`}>{s.value}</p>
              <p className="mt-1 text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card title="Risk of dropping">
            <Bars rows={charts.risk} />
          </Card>
          <Card title="Where families are">
            <Bars rows={charts.stage} />
          </Card>
          <Card title="Agent mode right now">
            <Bars rows={charts.mode} />
          </Card>
          <Card title="Top worries">
            {charts.worries.length ? <Bars rows={charts.worries} color="bg-amber-400" /> : <p className="text-xs text-slate-500">No worries logged yet.</p>}
          </Card>
          <Card title="Languages">
            <Bars rows={charts.language} color="bg-teal-500" />
          </Card>
          <Card title="Latest AI actions">
            <ul className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {data.recentEvents
                .map((e) => ({ e, d: describeEvent(e) }))
                .filter((x) => x.d)
                .slice(0, 15)
                .map(({ e, d }) => (
                  <li key={e.id} className="flex gap-2 text-xs">
                    <span>{d!.icon}</span>
                    <span className="text-slate-700">
                      <b className="font-medium">{names[e.leadId]?.split(" ")[0]}</b> · {d!.text}
                    </span>
                  </li>
                ))}
              {!data.recentEvents.length && <li className="text-xs text-slate-500">Chat as a family to see actions here.</li>}
            </ul>
          </Card>
        </div>

        <Card title="Experiment metrics (live from this demo)">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
            {[
              { label: "Enrolled", value: `${m.enrolled} of ${m.families}` },
              { label: "Engaged with companion", value: `${m.engaged}`, sub: `parents: ${m.parentsEngaged}` },
              { label: "Worries resolved", value: `${m.worriesResolved} of ${m.worriesRaised}` },
              { label: "Docs right first time", value: `${m.docsFirstTimeOk} of ${m.docTypes}` },
              { label: "Reminders sent", value: `${m.remindersSent}` },
              { label: "Handed to a counsellor", value: `${m.handovers}` },
              { label: "Not joining", value: `${m.notJoining}`, sub: "reminders stopped" },
            ].map((r) => (
              <div key={r.label} className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">{r.label}</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{r.value}</p>
                {r.sub && <p className="text-[11px] text-slate-500">{r.sub}</p>}
              </div>
            ))}
          </div>
        </Card>

        <ImpactCalculator />
      </main>
    </div>
  );
}
