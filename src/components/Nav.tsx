"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Families" },
  { href: "/counsellor", label: "Counsellor" },
  { href: "/admin", label: "Knowledge" },
  { href: "/about", label: "About" },
];

export function Nav() {
  const path = usePathname();
  if (path.startsWith("/brief")) return null; // printable page
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 no-underline">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-emerald-500 text-sm font-bold text-white">
            N
          </span>
          <span className="hidden text-sm font-semibold text-slate-900 sm:inline">
            Enrollment Companion <span className="font-normal text-slate-400">for NIAT</span>
          </span>
        </Link>
        <nav className="flex gap-1 text-xs sm:text-sm">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" || path.startsWith("/lead") : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-2.5 py-1.5 no-underline transition sm:px-3 ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
