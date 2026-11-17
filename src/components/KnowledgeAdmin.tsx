"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AnswerMode, KnowledgeEntry, Settings } from "@/lib/types";
import { activeEntries, matchKnowledge } from "@/lib/knowledge";
import { MODES, routeMode } from "@/lib/modes";
import { Card } from "./ui";

const MODE_OPTIONS: { id: AnswerMode; title: string; text: string }[] = [
  { id: "company_only", title: "Company answers only", text: "Says only what your team approved. Everything else goes to a counsellor." },
  { id: "company_and_public", title: "Company answers + public facts", text: "Also uses verified facts from niatindia.com, each with its source." },
];

const BULK_EXAMPLE = `Q: When do classes start?
Q: What is the joining date?
A: Classes start in the first week of August. Your counsellor shares the exact date.

Q: Is there a uniform?
A: It depends on the campus. Your counsellor will confirm.`;

type Draft = { title: string; answer: string; questions: string; source: string };
const EMPTY: Draft = { title: "", answer: "", questions: "", source: "NIAT team" };

export default function KnowledgeAdmin() {
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [bulk, setBulk] = useState("");
  const [test, setTest] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showPublic, setShowPublic] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/knowledge", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        setKnowledge(j.knowledge);
        setSettings(j.settings);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function post(body: unknown, label = "save") {
    setBusy(label);
    setError(null);
    const r = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    setBusy(null);
    if (!r.ok) {
      setError(j.error || "Failed");
      return false;
    }
    setKnowledge(j.knowledge);
    setSettings(j.settings);
    return true;
  }

  const usable = useMemo(() => (settings ? activeEntries(knowledge, settings.answerMode) : []), [knowledge, settings]);
  const matches = useMemo(() => (test.trim() ? matchKnowledge(usable, test) : []), [usable, test]);
  const testMode = test.trim() ? MODES[routeMode({ stage: "deciding", decision: "undecided" }, test).mode] : null;

  function startEdit(k?: KnowledgeEntry) {
    setEditing(k?.id ?? "new");
    setDraft(k ? { title: k.title, answer: k.answer, questions: (k.questions ?? []).join("\n"), source: k.source } : EMPTY);
  }

  async function save() {
    const ok = await post({
      action: "upsert",
      entry: {
        id: editing === "new" ? undefined : editing,
        title: draft.title,
        answer: draft.answer,
        source: draft.source,
        questions: draft.questions.split("\n"),
      },
    });
    if (ok) setEditing(null);
  }

  if (!settings) return <p className="p-8 text-slate-400">Loading…</p>;
  const company = knowledge.filter((k) => k.kind === "company");
  const pub = knowledge.filter((k) => k.kind === "public");

  const editor = (
    <div className="space-y-2 rounded-xl bg-violet-50/60 p-3 ring-1 ring-violet-200">
      <input
        value={draft.title}
        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        placeholder="Topic, e.g. Hostel fees"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
      />
      <textarea
        value={draft.questions}
        onChange={(e) => setDraft({ ...draft, questions: e.target.value })}
        placeholder={"How families ask it (one per line)\nIs there a hostel?\nWhere will my child stay?"}
        rows={3}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
      />
      <textarea
        value={draft.answer}
        onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
        placeholder="The approved answer, in English. The bot translates it into the family's language."
        rows={3}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={draft.source}
          onChange={(e) => setDraft({ ...draft, source: e.target.value })}
          placeholder="Approved by"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-violet-400"
        />
        <button onClick={() => setEditing(null)} className="rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-white">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={busy === "save" || !draft.title.trim() || !draft.answer.trim()}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          Save answer
        </button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">What the bot is allowed to say</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          The bot never searches the internet. It answers only from the answers below, translated into the family&apos;s
          language, and hands anything else to a counsellor.{" "}
          <Link href="/lead/ravi?as=parent" className="text-indigo-600">
            Try it in a chat →
          </Link>
        </p>
      </div>

      {error && <p className="rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}

      {/* 1. Test a question */}
      <Card title="1. Test a question">
        <input
          value={test}
          onChange={(e) => setTest(e.target.value)}
          placeholder="Type what a parent might ask, e.g. “will my daughter be safe in the hostel?”"
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
        />
        {test.trim() && (
          <div className="mt-3 space-y-2">
            {testMode && (
              <p className="text-xs text-slate-500">
                Handled in mode{" "}
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">
                  {testMode.icon} {testMode.label}
                </span>
              </p>
            )}
            {matches.length ? (
              matches.map(({ entry }) => (
                <div key={entry.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                  <p className="font-medium text-slate-900">
                    <span
                      className={`mr-1.5 rounded px-1.5 text-[10px] font-semibold ${entry.kind === "company" ? "bg-violet-100 text-violet-700" : "bg-emerald-100 text-emerald-700"}`}
                    >
                      {entry.id}
                    </span>
                    {entry.title}
                  </p>
                  <p className="mt-0.5 text-slate-600">{entry.answer}</p>
                </div>
              ))
            ) : (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                No approved answer covers this. The bot will hand it to a counsellor. Add an answer below so it can reply.
              </p>
            )}
          </div>
        )}
      </Card>

      {/* 2. Answer mode */}
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">2. What may the bot use?</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODE_OPTIONS.map((m) => {
            const on = settings.answerMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => post({ action: "setMode", mode: m.id }, "mode")}
                className={`rounded-2xl p-4 text-left transition ${on ? "bg-white shadow-md ring-2 ring-violet-500" : "bg-white/60 ring-1 ring-slate-200 hover:bg-white"}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-4 w-4 rounded-full border-2 ${on ? "border-violet-600 bg-violet-600 shadow-[inset_0_0_0_2px_white]" : "border-slate-300"}`}
                  />
                  <span className="text-sm font-semibold text-slate-900">{m.title}</span>
                </div>
                <p className="mt-1.5 pl-6 text-xs text-slate-500">{m.text}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Company answers */}
      <Card
        title={`3. Company answers (${company.length})`}
        right={
          editing !== "new" && (
            <button onClick={() => startEdit()} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500">
              + Add one answer
            </button>
          )
        }
      >
        <details className="mb-3 rounded-xl bg-slate-50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-800">Add many answers at once (paste Q: / A:)</summary>
          <p className="mt-2 text-xs text-slate-500">
            One block per answer, blocks separated by a blank line. Several Q: lines are different ways of asking the same
            thing.
          </p>
          <textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={BULK_EXAMPLE}
            rows={7}
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-violet-400"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setBulk(BULK_EXAMPLE)} className="rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-white">
              Use example
            </button>
            <button
              onClick={async () => {
                if (await post({ action: "bulkAdd", text: bulk }, "bulk")) setBulk("");
              }}
              disabled={!bulk.trim() || busy === "bulk"}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Add answers
            </button>
          </div>
        </details>

        <div className="space-y-2">
          {editing === "new" && editor}
          {company.map((k) =>
            editing === k.id ? (
              <div key={k.id}>{editor}</div>
            ) : (
              <div key={k.id} className={`flex gap-3 rounded-xl p-3 ring-1 ring-slate-100 ${k.enabled ? "" : "opacity-50"}`}>
                <span className="mt-0.5 shrink-0 rounded bg-violet-100 px-1.5 text-[10px] font-semibold text-violet-700">{k.id}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{k.title}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{k.answer}</p>
                  {!!k.questions?.length && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {k.questions.map((q) => (
                        <span key={q} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                          “{q}”
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                  <Toggle on={k.enabled} onClick={() => post({ action: "toggle", id: k.id })} />
                  <button onClick={() => startEdit(k)} className="text-slate-500 hover:text-slate-900">
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${k.title}"?`)) post({ action: "delete", id: k.id });
                    }}
                    className="text-rose-500 hover:text-rose-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      </Card>

      {/* 4. Public facts + live check */}
      <Card
        title={`4. Public facts from niatindia.com (${pub.length})`}
        right={
          <div className="flex gap-2">
            <button
              onClick={() => post({ action: "checkSite" }, "check")}
              disabled={busy === "check"}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy === "check" ? "Checking…" : "Check against live site"}
            </button>
            <button
              onClick={() => {
                if (confirm("Restore the default knowledge base and answer mode?")) post({ action: "restoreDefaults" });
              }}
              className="rounded-lg px-3 py-1.5 text-xs text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Restore defaults
            </button>
          </div>
        }
      >
        {settings.answerMode === "company_only" && (
          <p className="mb-2 text-xs text-amber-700">Not used while “Company answers only” is selected.</p>
        )}
        {settings.lastRefresh && (
          <ul className="mb-3 space-y-1 rounded-xl bg-slate-50 p-3">
            <li className="text-[11px] text-slate-500">
              Last checked {new Date(settings.lastRefresh.at).toLocaleString("en-IN")} against niatindia.com/llm-info
            </li>
            {settings.lastRefresh.checks.map((c) => (
              <li key={c.id} className="flex gap-2 text-xs">
                <span
                  className={`shrink-0 rounded px-1.5 font-semibold ${
                    c.status === "supported"
                      ? "bg-emerald-100 text-emerald-700"
                      : c.status === "changed"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {c.status === "supported" ? "✓ still true" : c.status === "changed" ? "changed" : "not found"}
                </span>
                <span className="text-slate-700">
                  {c.id}: {c.note}
                </span>
              </li>
            ))}
          </ul>
        )}
        <button onClick={() => setShowPublic((v) => !v)} className="text-xs font-medium text-indigo-600">
          {showPublic ? "Hide facts" : `Show all ${pub.length} facts`}
        </button>
        {showPublic && (
          <div className="mt-2 divide-y divide-slate-100">
            {pub.map((k) => (
              <div key={k.id} className={`flex items-start gap-3 py-2.5 ${k.enabled ? "" : "opacity-50"}`}>
                <span className="mt-0.5 shrink-0 rounded bg-emerald-100 px-1.5 text-[10px] font-semibold text-emerald-700">{k.id}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{k.title}</p>
                  <p className="text-xs text-slate-600">{k.answer}</p>
                  <a href={k.source} target="_blank" rel="noreferrer" className="text-[11px] text-emerald-700">
                    {k.source}
                  </a>
                </div>
                <Toggle on={k.enabled} onClick={() => post({ action: "toggle", id: k.id })} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={on ? "In use: click to disable" : "Disabled: click to enable"}
      className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-emerald-500" : "bg-slate-300"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}
