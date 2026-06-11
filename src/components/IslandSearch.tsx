"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Result {
  type: string;
  id: string;
  label: string;
  status?: string | null;
  conflicts?: number;
  href: string;
}

export default function IslandSearch({ placeholder = "Search islands, atolls, resorts…", compact = false }: { placeholder?: string; compact?: boolean }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div ref={boxRef} className="relative w-full max-w-xl">
      <div className="flex items-center gap-2 bg-white rounded border border-border-subtle focus-within:border-reef focus-within:ring-2 focus-within:ring-reef/30 px-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#43474f" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder={placeholder}
          aria-label="Search the island registry"
          className={`flex-1 bg-transparent outline-none text-ink ${compact ? "py-2.5 text-sm" : "py-3.5"} min-h-[44px]`}
        />
        {loading && <span className="text-xs text-ink-soft animate-pulse">…</span>}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full bg-white border border-border-subtle rounded-lg shadow-float max-h-80 overflow-auto">
          {results.map((r) => (
            <li key={`${r.type}-${r.id}`}>
              <Link
                href={r.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between gap-2 px-4 py-3 min-h-[44px] hover:bg-sand text-sm"
              >
                <span className="truncate">
                  <span className="label-md text-ink-soft mr-2">{r.type}</span>
                  {r.label}
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  {r.status && <span className="badge badge-info">{r.status}</span>}
                  {!!r.conflicts && <span className="badge badge-conflict">⚠ {r.conflicts}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {open && q.trim() && !loading && results.length === 0 && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-border-subtle rounded-lg px-4 py-3 text-sm text-ink-soft">
          No matches for “{q}”.
        </div>
      )}
    </div>
  );
}
