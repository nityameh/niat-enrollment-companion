"use client";

import type { AppEvent, Stage } from "@/lib/types";
import { STAGE_ORDER } from "@/lib/types";
import { describeEvent } from "@/lib/events";
import { MODES, modeForStage } from "@/lib/modes";
import type { ClientLead } from "./PhoneChat";
import { Card, RiskBadge, stageLabel } from "./ui";

const JOURNEY: Stage[] = STAGE_ORDER.filter((s) => s !== "counselled");

interface Props {
  lead: ClientLead;
  events: AppEvent[];
  now: number;
  busy: string | null;
  onSkip: () => void;
  onBrief: () => void;
}

export default function BehindScenes({ lead, events, now, busy, onSkip, onBrief }: Props) {
  const uni = lead.university;
  const idx = JOURNEY.indexOf(lead.stage);
  const deadline = uni ? lead.counselledAt + uni.applicationDeadlineDays * 86_400_000 : null;
  const daysLeft = deadline ? Math.ceil((deadline - now) / 86_400_000) : null;
  const feed = events.map((e) => ({ e, d: describeEvent(e) })).filter((x) => x.d);
  const currentMode = lead.mode ?? modeForStage(lead.stage);

  return (
    <div className="space-y-4">
      {/* Demo controls */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onSkip}
          disabled={!!busy}
          className="rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-50"
          title="Move the demo clock forward 3 days and run the reminder engine"
        >
          {busy === "skip" ? "Running…" : "⏩ Skip 3 days"}
        </button>
        <button
          onClick={onBrief}
          disabled={!!busy}
          className="rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy === "brief" ? "Writing…" : "📄 Decision Brief"}
        </button>
      </div>

      {/* Journey */}
      <Card title="Journey" right={<RiskBadge risk={lead.risk} />}>
        {lead.stage === "dropped" ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Family decided not to join. Reminders stopped{lead.decisionReason ? `: “${lead.decisionReason}”` : "."}
          </p>
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
        <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
          {lead.risk.reasons.map((r) => (
            <li key={r}>• {r}</li>
          ))}
        </ul>
      </Card>

      {/* Agent mode */}
      <Card title="Agent mode" right={<span className="text-[11px] text-slate-400">switches by stage and question</span>}>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {Object.values(MODES).map((m) => {
            const on = m.id === currentMode;
            return (
              <div
                key={m.id}
                title={m.summary}
                className={`rounded-xl px-2 py-2 text-center transition ${on ? "bg-indigo-600 text-white shadow-md" : "bg-slate-50 text-slate-500"}`}
              >
                <div className="text-base leading-none">{m.icon}</div>
                <div className="mt-1 text-[10.5px] font-medium leading-tight">{m.label}</div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-600">{MODES[currentMode].summary}</p>
      </Card>

      {/* Documents */}
      <Card
        title="University application documents"
        right={
          daysLeft !== null ? (
            <span className={`text-xs ${daysLeft <= 3 ? "font-semibold text-rose-600" : "text-slate-500"}`}>
              {daysLeft > 0 ? `${daysLeft} days left` : "Deadline passed"}
            </span>
          ) : null
        }
      >
        <ul className="space-y-2">
          {(uni?.requiredDocs ?? []).map((d) => {
            const doc = [...lead.docs].reverse().find((x) => x.type === d.id);
            const st = doc?.status ?? "missing";
            return (
              <li key={d.id} className="flex items-start gap-2.5 text-sm">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                    st === "ok" ? "bg-emerald-100 text-emerald-700" : st === "flagged" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {st === "ok" ? "✓" : st === "flagged" ? "!" : "○"}
                </span>
                <div className="min-w-0">
                  <p className="text-slate-800">{d.label}</p>
                  {doc?.status === "flagged" && <p className="text-xs text-rose-600">{doc.issues[0]?.message}</p>}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[11px] text-slate-400">Send photos with 📎 in the chat. Partner universities and rules are demo data.</p>
      </Card>

      {/* What the AI did */}
      <Card title="What the AI did" right={<span className="text-[11px] text-slate-400">live</span>}>
        {feed.length === 0 ? (
          <p className="text-xs text-slate-500">Send a message. Every action the agent takes shows up here.</p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {feed.map(({ e, d }) => (
              <li key={e.id} className="flex gap-2 text-xs">
                <span>{d!.icon}</span>
                <span className="flex-1 text-slate-700">{d!.text}</span>
                <span className="shrink-0 text-slate-400">
                  {new Date(e.ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
