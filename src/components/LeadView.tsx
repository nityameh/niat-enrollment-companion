"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppEvent, AnswerMode, DocType } from "@/lib/types";
import { LANG_NAMES } from "@/lib/types";
import type { SourceMap } from "@/lib/knowledge";
import PhoneChat, { type ClientLead } from "./PhoneChat";
import { ActivityLog, JourneyBar } from "./FamilyPanels";
import { Avatar, ModeBadge } from "./ui";

interface Meta {
  aiEnabled: boolean;
  provider: string;
  now: number;
  clockOffsetDays: number;
}

export default function LeadView({ leadId, initialRole }: { leadId: string; initialRole: "student" | "parent" }) {
  const [lead, setLead] = useState<ClientLead | null>(null);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [sources, setSources] = useState<SourceMap>({});
  const [meta, setMeta] = useState<Meta | null>(null);
  const [role, setRole] = useState<"student" | "parent">(initialRole);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const fetchLead = useCallback(async () => {
    const r = await fetch(`/api/lead/${leadId}`, { cache: "no-store" });
    return r.ok ? r.json() : null;
  }, [leadId]);

  const apply = useCallback((j: { lead: ClientLead; events: AppEvent[]; sources: SourceMap; answerMode: AnswerMode; meta: Meta } | null) => {
    if (!j) return setError("Family not found");
    setLead(j.lead);
    setEvents(j.events);
    setSources(j.sources);
    setMeta(j.meta);
  }, []);

  const refresh = useCallback(async () => apply(await fetchLead()), [apply, fetchLead]);

  useEffect(() => {
    let alive = true;
    fetchLead().then((j) => alive && apply(j));
    return () => {
      alive = false;
    };
  }, [fetchLead, apply]);

  async function run(label: string, fn: () => Promise<Response>) {
    setBusy(label);
    setError(null);
    try {
      const r = await fn();
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Something went wrong");
      if (j.result?.error) setError(`AI error: ${j.result.error}`);
      return j;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      await refresh();
      setBusy(null);
    }
  }

  function send(text: string) {
    // Show the message immediately while the agent thinks.
    setLead((l) => (l ? { ...l, chat: [...l.chat, { id: "pending", role, text, ts: meta?.now ?? Date.now() }] } : l));
    run("chat", () =>
      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, role, text }),
      }),
    );
  }

  function upload(docType: DocType, file: File) {
    const fd = new FormData();
    fd.set("leadId", leadId);
    fd.set("docType", docType);
    fd.set("file", file);
    run(`doc:${docType}`, () => fetch("/api/upload", { method: "POST", body: fd }));
  }

  async function sample(docType: DocType, file: string) {
    const blob = await (await fetch(`/samples/${file}`)).blob();
    upload(docType, new File([blob], file, { type: "image/png" }));
  }

  function skip() {
    run("skip", () =>
      fetch("/api/clock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days: 3 }) }),
    );
  }


  if (error && !lead) return <p className="p-8 text-rose-700">{error}</p>;
  if (!lead || !meta) return <p className="p-8 text-slate-400">Loading…</p>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Family header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={lead.studentName} className="h-11 w-11 text-sm" />
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {lead.studentName} <span className="font-normal text-slate-400">& {lead.parentName}</span>
            </h1>
            <p className="text-xs text-slate-500">
              {lead.city} · prefers {LANG_NAMES[lead.language]} · {lead.university?.name} · demo date{" "}
              {new Date(meta.now).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ModeBadge ai={meta.aiEnabled} label={meta.provider} />
        </div>
      </div>

      {error && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}

      <JourneyBar lead={lead} busy={busy} onRemind={skip} />

      <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
        <PhoneChat
          lead={lead}
          role={role}
          onRole={setRole}
          sources={sources}
          busy={busy}
          onSend={send}
          onUpload={upload}
          onSample={sample}
        />
        </div>
        {/* Log sits beside the chat: a small button until opened */}
        <div className={`lg:sticky lg:top-20 ${logOpen ? "lg:w-[300px]" : "lg:w-[190px]"}`}>
          <ActivityLog events={events} open={logOpen} onToggle={() => setLogOpen((v) => !v)} />
        </div>
      </div>
    </div>
  );
}
