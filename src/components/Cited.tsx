import type { SourceMap } from "@/lib/knowledge";

/** Renders text, turning ids like [F2] / [C1] into small source chips. */
export function Cited({ text, sources }: { text: string; sources: SourceMap }) {
  const parts = text.split(/(\[[FC]\d+\])/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\[([FC]\d+)\]$/);
        const s = m ? sources[m[1]] : undefined;
        if (!m || !s) return <span key={i}>{p}</span>;
        const chip = "mx-0.5 inline-block rounded px-1 align-super text-[9px] font-semibold leading-tight no-underline";
        return s.kind === "company" ? (
          <span key={i} title={`NIAT-approved answer: ${s.title}`} className={`${chip} bg-violet-100 text-violet-700`}>
            {m[1]}
          </span>
        ) : (
          <a
            key={i}
            href={s.source}
            target="_blank"
            rel="noreferrer"
            title={`Public fact: ${s.title}`}
            className={`${chip} bg-emerald-100 text-emerald-700 hover:bg-emerald-200`}
          >
            {m[1]}
          </a>
        );
      })}
    </>
  );
}
