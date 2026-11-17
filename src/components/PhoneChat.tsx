"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DocType, Lead, University } from "@/lib/types";
import type { SourceMap } from "@/lib/knowledge";
import { Cited } from "./Cited";
import { MODES, modeForStage } from "@/lib/modes";

export type ClientLead = Omit<Lead, "apiMessages"> & { university?: University };

export const SAMPLES: Record<DocType, { label: string; file: string }[]> = {
  marksheet_12: [
    { label: "correct", file: "ravi_marksheet_12_correct.png" },
    { label: "name typo", file: "ravi_marksheet_12_name_mismatch.png" },
  ],
  marksheet_10: [{ label: "correct", file: "ravi_marksheet_10_correct.png" }],
  transfer_certificate: [
    { label: "correct", file: "ravi_transfer_certificate_correct.png" },
    { label: "cut off", file: "ravi_transfer_certificate_cut.png" },
  ],
};

const time = (ts: number) => new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
const day = (ts: number) => new Date(ts).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

interface Props {
  lead: ClientLead;
  role: "student" | "parent";
  onRole: (r: "student" | "parent") => void;
  sources: SourceMap;
  busy: string | null;
  onSend: (text: string) => void;
  onUpload: (docType: DocType, file: File) => void;
  onSample: (docType: DocType, file: string) => void;
}

export default function PhoneChat({ lead, role, onRole, sources, busy, onSend, onUpload, onSample }: Props) {
  const [input, setInput] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const me = role === "parent" ? lead.parentName : lead.studentName;
  const mode = MODES[lead.mode ?? modeForStage(lead.stage)];

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lead.chat.length, busy]);

  function submit(text: string) {
    if (!text.trim() || busy) return;
    onSend(text.trim());
    setInput("");
  }

  return (
    <div className="flex h-full flex-col items-center">
      {/* Tablet: fills the height it is given (the page sizes it to the screen) */}
      <div className="relative flex h-full w-full max-w-[920px] flex-col rounded-[1.6rem] bg-slate-900 p-2.5 shadow-2xl shadow-slate-900/20">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.1rem] bg-[#efeae2]">
          {/* Chat header, with the "who am I" switch */}
          <div className="flex flex-wrap items-center gap-3 bg-[#075e54] px-4 py-2.5 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-bold text-[#075e54]">N</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">NIAT Companion</p>
              <p className="truncate text-[11px] text-white/75">{busy === "chat" ? "typing…" : `${mode.icon} ${mode.label} · AI assistant`}</p>
            </div>
            <div className="flex rounded-full bg-white/15 p-0.5 text-[11px] font-medium" title="Chat as the parent or the student">
              {(["parent", "student"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => onRole(r)}
                  className={`rounded-full px-3 py-1 transition ${role === r ? "bg-white text-[#075e54] shadow" : "text-white/85 hover:text-white"}`}
                >
                  {r === "parent" ? `Parent · ${lead.parentName.split(" ")[0]}` : `Student · ${lead.studentName.split(" ")[0]}`}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div
            className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3"
            style={{
              backgroundImage: "radial-gradient(rgba(0,0,0,0.035) 1px, transparent 1px)",
              backgroundSize: "14px 14px",
            }}
          >
            <div className="mx-auto mb-2 max-w-[90%] rounded-lg bg-[#fff5c4] px-3 py-1.5 text-center text-[10.5px] leading-snug text-slate-700 shadow-sm">
              Simulated WhatsApp · you are the <b>{role}</b>, {me}
            </div>

            {lead.chat.map((m, i) => {
              const d = day(m.ts);
              const showDay = i === 0 || d !== day(lead.chat[i - 1].ts);
              const mine = m.role === role;
              const family = m.role === "student" || m.role === "parent";
              return (
                <div key={m.id + m.ts}>
                  {showDay && (
                    <div className="my-2 flex justify-center">
                      <span className="rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-medium text-slate-500 shadow-sm">{d}</span>
                    </div>
                  )}
                  <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`relative max-w-[68%] rounded-lg px-2.5 pb-1 pt-1.5 text-[13px] leading-snug text-slate-900 shadow-sm ${
                        mine ? "rounded-tr-none bg-[#d9fdd3]" : "rounded-tl-none bg-white"
                      }`}
                    >
                      {family && !mine && (
                        <p className="mb-0.5 text-[11px] font-semibold text-orange-600">
                          {m.role === "parent" ? lead.parentName : lead.studentName} ({m.role})
                        </p>
                      )}
                      {m.kind === "reminder" && <p className="mb-0.5 text-[11px] font-semibold text-[#075e54]">🔔 Reminder</p>}
                      {m.kind === "brief" ? (
                        <Link
                          href={`/brief/${lead.id}`}
                          target="_blank"
                          className="flex items-center gap-2.5 rounded-md bg-slate-50 p-2 no-underline ring-1 ring-slate-200 hover:bg-slate-100"
                        >
                          <span className="flex h-9 w-8 items-center justify-center rounded bg-rose-500 text-[9px] font-bold text-white">PDF</span>
                          <span className="min-w-0">
                            <span className="block truncate text-[12.5px] font-semibold">Decision Brief</span>
                            <span className="block truncate text-[11px] text-slate-500">{m.text}</span>
                          </span>
                        </Link>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{family ? m.text : <Cited text={m.text} sources={sources} />}</p>
                      )}
                      <p className="mt-0.5 text-right text-[9.5px] text-slate-500">
                        {time(m.ts)} {mine && <span className="text-sky-500">✓✓</span>}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {busy === "chat" && (
              <div className="flex justify-start">
                <div className="flex gap-1 rounded-lg rounded-tl-none bg-white px-3 py-2.5 shadow-sm">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${i * 120}ms` }} />
                  ))}
                </div>
              </div>
            )}
            {busy?.startsWith("doc:") && <p className="text-center text-[11px] text-slate-500">Checking your document…</p>}
            <div ref={end} />
          </div>

          {/* Quick replies */}
          {!busy && (
            <div className="flex gap-1.5 overflow-x-auto bg-[#efeae2] px-3 pb-1.5 [scrollbar-width:none]">
              {mode.quickReplies[role].map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="shrink-0 rounded-full border border-[#075e54]/20 bg-white px-3 py-1 text-[11.5px] text-[#075e54] shadow-sm hover:bg-emerald-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Attach sheet */}
          {attachOpen && (
            <div className="mx-2 mb-1 rounded-xl bg-white p-3 text-xs shadow-lg ring-1 ring-slate-200">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold text-slate-800">Send a document photo</p>
                <button onClick={() => setAttachOpen(false)} className="text-slate-400 hover:text-slate-700">
                  ✕
                </button>
              </div>
              <div className="space-y-2">
                {(lead.university?.requiredDocs ?? []).map((d) => (
                  <div key={d.id} className="flex flex-wrap items-center gap-1.5">
                    <span className="w-28 font-medium text-slate-700">{d.label}</span>
                    {SAMPLES[d.id].map((s) => (
                      <button
                        key={s.file}
                        onClick={() => {
                          setAttachOpen(false);
                          onSample(d.id, s.file);
                        }}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 hover:bg-slate-200"
                      >
                        sample: {s.label}
                      </button>
                    ))}
                    <label className="cursor-pointer rounded-full bg-[#075e54] px-2 py-0.5 text-white hover:opacity-90">
                      my photo
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            setAttachOpen(false);
                            onUpload(d.id, f);
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
            className="flex items-center gap-2 bg-[#efeae2] px-2 pb-3 pt-1"
          >
            <div className="flex flex-1 items-center rounded-full bg-white px-3 shadow-sm">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message"
                className="min-w-0 flex-1 bg-transparent py-2.5 text-[13.5px] outline-none"
              />
              <button
                type="button"
                onClick={() => setAttachOpen((v) => !v)}
                className="ml-1 text-lg text-slate-500 hover:text-slate-800"
                title="Send a document photo"
              >
                📎
              </button>
            </div>
            <button
              disabled={!!busy || !input.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00a884] text-white shadow disabled:opacity-60"
              title="Send"
            >
              ➤
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
