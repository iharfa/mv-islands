"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/map", label: "Map Explorer" },
  { href: "/atolls", label: "Atolls" },
  { href: "/islands", label: "Islands" },
  { href: "/environment", label: "Environment" },
  { href: "/conflicts", label: "Conflicts" },
  { href: "/downloads", label: "Downloads" },
  { href: "/sources", label: "Sources" },
  { href: "/api-docs", label: "API" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-ocean text-white shadow-float">
      <div className="mx-auto max-w-[1440px] px-4 md:px-10 flex items-center justify-between h-14">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight min-h-[44px]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="10" stroke="#00CED1" strokeWidth="2" />
            <circle cx="12" cy="12" r="4" fill="#00CED1" />
          </svg>
          <span className="whitespace-nowrap text-[15px]">Maldives Island Registry</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 rounded text-[13px] font-medium min-h-[44px] inline-flex items-center transition-colors ${
                pathname?.startsWith(item.href)
                  ? "bg-white/15 text-white"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/admin"
            className="ml-2 px-3 py-1.5 rounded border border-reef text-reef text-[13px] font-semibold min-h-[44px] inline-flex items-center hover:bg-reef hover:text-ocean-deep transition-colors"
          >
            Admin
          </Link>
        </nav>

        <button
          className="lg:hidden p-3 -mr-2 min-h-[44px] min-w-[44px]"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="lg:hidden border-t border-white/15 bg-ocean-deep px-4 pb-4 pt-2">
          {[...NAV, { href: "/admin", label: "Admin" }].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block px-3 py-3 rounded text-[15px] font-medium text-white/90 hover:bg-white/10 min-h-[44px]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
