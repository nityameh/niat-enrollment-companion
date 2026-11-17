"use client";

import { useState } from "react";
import type { AppEvent, Stage } from "@/lib/types";
import { STAGE_ORDER } from "@/lib/types";
import { describeEvent } from "@/lib/events";
import { MODES, modeForStage } from "@/lib/modes";
import type { ClientLead } from "./PhoneChat";
import { RiskBadge, stageLabel } from "./ui";

// Journey starts at the one-on-one counselling, which every family here has done.
const JOURNEY: Stage[] = STAGE_ORDER;

/** Top bar: journey stepper, risk, agent mode tag and the reminder button. */
export function JourneyBar({ lead, busy, onRemind }: { lead: ClientLead; busy: string | null; onRemind: () => void }) {
  const [modesOpen, setModesOpen] = useState(false);
  const idx = JOURNEY.indexOf(lead.stage);
  const mode = MODES[lead.mode ?? modeForStage(lead.stage)];

  return (
    <section className="shrink-0 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {/* Stepper */}
        <div className="min-w-[280px] flex-1">
          {lead.stage === "dropped" ? (
            <p className="text-sm text-rose-700">Decided not to join · reminders stopped{lead.decisionReason ? ` · “${lead.decisionReason}”` : ""}</p>
          ) : (
            <ol className="flex items-center">
              {JOURNEY.map((s, i) => (
                <li key={s} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                        i < idx ? "bg-emerald-500 text-white" : i === idx ? "bg-indigo-600 text-white ring-4 ring-indigo-100" : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {i < idx ? "✓" : i + 1}
                    </span>
                    <span className={`w-16 text-center text-[10px] leading-tight ${i === idx ? "font-semibold text-slate-900" : "text-slate-500"}`}>
                      {stageLabel(s)}
                    </span>
                  </div>
                  {i < JOURNEY.length - 1 && <span className={`mb-4 h-0.5 flex-1 ${i < idx ? "bg-emerald-400" : "bg-slate-200"}`} />}
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Risk + mode tag */}
        <div className="flex flex-wrap items-center gap-2">
          <RiskBadge risk={lead.risk} />
          <div className="relative">
            <button
              onClick={() => setModesOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100"
              title="The agent switches mode by journey stage and question"
            >
              {mode.icon} {mode.label} <span className="text-[10px]">{modesOpen ? "▲" : "▼"}</span>
            </button>
            {modesOpen && (
              <div className="absolute right-0 z-10 mt-2 w-72 rounded-xl bg-white p-2 shadow-lg ring-1 ring-slate-200">
                <p className="px-2 pb-1 text-[11px] text-slate-500">Agent modes (switch by stage and question)</p>
                {Object.values(MODES).map((m) => (
                  <div key={m.id} className={`rounded-lg px-2 py-1.5 ${m.id === mode.id ? "bg-indigo-50" : ""}`}>
                    <p className={`text-xs ${m.id === mode.id ? "font-semibold text-indigo-700" : "text-slate-800"}`}>
                      {m.icon} {m.label}
                    </p>
                    <p className="text-[11px] text-slate-500">{m.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Reminder */}
        <div className="text-right">
          <button
            onClick={onRemind}
            disabled={!!busy}
            className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-700 disabled:opacity-50"
          >
            {busy === "skip" ? "Sending…" : "🔔 Send automatic reminder now"}
          </button>
          <p className="mt-1 max-w-[240px] text-[10.5px] leading-tight text-slate-500">
            Live: sent automatically after 3 days without a reply. Demo: moves the clock 3 days.
          </p>
        </div>
      </div>

      <DocTrack lead={lead} />
    </section>
  );
}

/** Documents as a thin track: one line with a point per document. */
function DocTrack({ lead }: { lead: ClientLead }) {
  const docs = lead.university?.requiredDocs ?? [];
  if (!docs.length) return null;
  const flagged: string[] = [];
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2">
      <span className="text-[11px] font-medium text-slate-500">University documents</span>
      <div className="flex items-center">
        {docs.map((d, i) => {
          const doc = [...lead.docs].reverse().find((x) => x.type === d.id);
          const st = doc?.status ?? "missing";
          if (st === "flagged" && doc?.issues[0]) flagged.push(`${d.label}: ${doc.issues[0].message}`);
          return (
            <div key={d.id} className="flex items-center" title={`${d.label}: ${st === "ok" ? "verified" : st === "flagged" ? "needs fix" : "missing"}`}>
              <span className="flex items-center gap-1">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${st === "ok" ? "bg-emerald-500" : st === "flagged" ? "bg-rose-500" : "bg-slate-300"}`}
                />
                <span className={`text-[11px] ${st === "flagged" ? "text-rose-700" : "text-slate-600"}`}>{d.label}</span>
              </span>
              {i < docs.length - 1 && <span className="mx-2 h-px w-6 bg-slate-300" />}
            </div>
          );
        })}
      </div>
      {flagged.length > 0 && <span className="text-[11px] text-rose-600">⚠ {flagged[0]}</span>}
    </div>
  );
}

/** Collapsible log of what the agent did for this family. */
export function ActivityLog({ events, open, onToggle }: { events: AppEvent[]; open: boolean; onToggle: () => void }) {
  const feed = events.map((e) => ({ e, d: describeEvent(e) })).filter((x) => x.d);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
      >
        <span>📋 What the AI did ({feed.length})</span>
        <span>{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <ul className="mt-2 max-h-[50vh] min-h-0 flex-1 space-y-2 overflow-y-auto rounded-xl bg-white p-3 ring-1 ring-slate-200 lg:max-h-none">
          {feed.length === 0 && <li className="text-xs text-slate-500">Send a message: every action the agent takes appears here.</li>}
          {feed.map(({ e, d }) => (
            <li key={e.id} className="flex gap-2 text-xs">
              <span>{d!.icon}</span>
              <span className="flex-1 text-slate-700">{d!.text}</span>
              <span className="shrink-0 text-slate-400">{new Date(e.ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
