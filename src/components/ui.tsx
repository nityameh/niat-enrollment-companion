import type { Risk, Stage } from "@/lib/types";

export function RiskBadge({ risk }: { risk: Risk }) {
  const cls =
    risk.band === "red"
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : risk.band === "amber"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-emerald-50 text-emerald-700 ring-emerald-200";
  const label = risk.band === "red" ? "High risk" : risk.band === "amber" ? "Medium risk" : "Low risk";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${risk.band === "red" ? "bg-rose-500" : risk.band === "amber" ? "bg-amber-500" : "bg-emerald-500"}`} />
      {label} · {risk.score}
    </span>
  );
}

const STAGE_LABEL: Record<Stage, string> = {
  counselled: "Counselling done",
  scholarship_paid: "Scholarship paid",
  deciding: "Deciding",
  applying: "Applying",
  documents_done: "Documents done",
  enrolled: "Enrolled",
  dropped: "Not joining",
};

export function stageLabel(s: Stage) {
  return STAGE_LABEL[s];
}

export function ModeBadge({ ai, label }: { ai: boolean; label?: string }) {
  return ai ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
      {label ?? "AI on"}
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200"
      title="No API key configured. Replies come from simple rules so the flow can be explored."
    >
      Mock mode (no API key)
    </span>
  );
}

export function Avatar({ name, className = "" }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${className}`}
      style={{ background: `hsl(${hue} 55% 48%)` }}
    >
      {initials}
    </span>
  );
}

export function Card({ title, children, right }: { title?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <h2 className="text-sm font-semibold text-slate-800">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function DemoBanner() {
  return (
    <div className="truncate whitespace-nowrap bg-slate-900 px-4 py-1.5 text-center text-[11px] text-slate-300">
      Demo for the NxtWave Growth Hack Challenge · all families, documents and university rules are synthetic · not an
      official NIAT product
    </div>
  );
}
