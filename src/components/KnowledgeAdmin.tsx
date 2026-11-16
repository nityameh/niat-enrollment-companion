"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AnswerMode, KnowledgeEntry, Settings } from "@/lib/types";
import { Card } from "./ui";

const MODES: { id: AnswerMode; title: string; text: string }[] = [
  {
    id: "company_only",
    title: "Company answers only",
    text: "The bot says only what your team approved below. Anything else goes to a counsellor.",
  },
  {
    id: "company_and_public",
    title: "Company answers + public facts",
    text: "Company answers first. It may also use verified facts from NIAT's public website.",
  },
];

export default function KnowledgeAdmin() {
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", answer: "", source: "NIAT team" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/knowledge", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setKnowledge(j.knowledge);
        setSettings(j.settings);
      });
  }, []);

  async function post(body: unknown) {
    setSaving(true);
    setError(null);
    const r = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    setSaving(false);
    if (!r.ok) return setError(j.error || "Failed"), false;
    setKnowledge(j.knowledge);
    setSettings(j.settings);
    return true;
  }

  function startEdit(k?: KnowledgeEntry) {
    setEditing(k?.id ?? "new");
    setDraft(k ? { title: k.title, answer: k.answer, source: k.source } : { title: "", answer: "", source: "NIAT team" });
  }

  async function save() {
    const ok = await post({ action: "upsert", entry: { ...draft, id: editing === "new" ? undefined : editing } });
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
        value={draft.answer}
        onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
        placeholder="The exact answer the bot should give (it will translate it into the family's language)"
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
          disabled={saving || !draft.title.trim() || !draft.answer.trim()}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save answer"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">What the bot is allowed to say</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          The bot never searches the internet. It answers only from this knowledge base, in the family&apos;s language,
          and hands anything else to a counsellor. Changes apply to the next message.{" "}
          <Link href="/lead/ravi?as=parent" className="text-indigo-600">
            Try it in a chat →
          </Link>
        </p>
      </div>

      {error && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}

      {/* Mode */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {MODES.map((m) => {
          const on = settings.answerMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => post({ action: "setMode", mode: m.id })}
              className={`rounded-2xl p-4 text-left transition ${on ? "bg-white shadow-md ring-2 ring-violet-500" : "bg-white/60 ring-1 ring-slate-200 hover:bg-white"}`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-4 w-4 rounded-full border-2 ${on ? "border-violet-600 bg-violet-600 shadow-[inset_0_0_0_2px_white]" : "border-slate-300"}`} />
                <span className="text-sm font-semibold text-slate-900">{m.title}</span>
              </div>
              <p className="mt-1.5 pl-6 text-xs text-slate-500">{m.text}</p>
            </button>
          );
        })}
      </div>

      {/* Company answers */}
      <Card
        title={`Company-approved answers (${company.length})`}
        right={
          editing !== "new" && (
            <button onClick={() => startEdit()} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500">
              + Add answer
            </button>
          )
        }
      >
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
                  <p className="mt-1 text-[11px] text-slate-400">{k.source}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                  <Toggle on={k.enabled} onClick={() => post({ action: "toggle", id: k.id })} />
                  <button onClick={() => startEdit(k)} className="text-slate-500 hover:text-slate-900">
                    Edit
                  </button>
                  <button
                    onClick={() => confirm(`Delete "${k.title}"?`) && post({ action: "delete", id: k.id })}
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

      {/* Public facts */}
      <div className={`mt-6 transition ${settings.answerMode === "company_only" ? "opacity-50" : ""}`}>
        <Card
          title={`Public facts from niatindia.com (${pub.length})`}
          right={
            settings.answerMode === "company_only" ? (
              <span className="text-xs text-slate-500">Not used in “company answers only” mode</span>
            ) : null
          }
        >
          <div className="divide-y divide-slate-100">
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
        </Card>
      </div>
      <p className="mt-4 text-center text-[11px] text-slate-400">Demo: no login on this page. A real deployment needs staff accounts and an audit log.</p>
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
