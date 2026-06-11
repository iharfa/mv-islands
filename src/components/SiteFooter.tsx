import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="bg-ocean-deep text-white mt-auto">
      <div className="mx-auto max-w-[1440px] px-4 md:px-10 py-10 grid gap-8 md:grid-cols-4">
        <div className="md:col-span-1">
          <div className="flex items-center gap-2 font-semibold mb-3">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="10" stroke="#00CED1" strokeWidth="2" />
              <circle cx="12" cy="12" r="4" fill="#00CED1" />
            </svg>
            <span>Coalition for Open Governance</span>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            The Coalition for Open Governance operates under the Single
            Coalition for Good Governance, mandated to empower civic society
            through radical transparency and help direct public policy in the
            Maldives. Built with public assets, by the public, for the public.
          </p>
        </div>

        <div>
          <h3 className="label-md text-reef mb-3">Registry</h3>
          <ul className="space-y-2 text-sm text-white/80">
            <li><Link className="hover:text-white" href="/map">Map Explorer</Link></li>
            <li><Link className="hover:text-white" href="/islands">Islands</Link></li>
            <li><Link className="hover:text-white" href="/atolls">Atolls</Link></li>
            <li><Link className="hover:text-white" href="/environment">Environmental Dashboard</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="label-md text-reef mb-3">Open Data</h3>
          <ul className="space-y-2 text-sm text-white/80">
            <li><Link className="hover:text-white" href="/downloads">Data Downloads</Link></li>
            <li><Link className="hover:text-white" href="/conflicts">Data Conflicts</Link></li>
            <li><Link className="hover:text-white" href="/sources">Source Registry</Link></li>
            <li><Link className="hover:text-white" href="/api-docs">API Documentation</Link></li>
          </ul>
        </div>

        <div className="md:col-span-1">
          <blockquote className="text-sm italic text-white/80 border-l-2 border-reef pl-4 leading-relaxed">
            “Open Data redistributes power that has been consolidated by a few.
            Those who benefit from secrecy will fight it. They will lose. Open
            Data is inevitable, question is will you proactively embrace it?”
          </blockquote>
          <p className="mt-3 text-xs font-semibold text-reef">
            AHMED AFRAH ISMAIL
            <span className="block font-normal text-white/60">
              Coalition for Open Governance
            </span>
          </p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-[1440px] px-4 md:px-10 py-4 flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between text-xs text-white/50">
          <p>
            Every public data point on this portal discloses its source,
            scrape date and verification status. Conflicting values are never
            silently resolved.
          </p>
          <p className="whitespace-nowrap">© {new Date().getFullYear()} Coalition for Open Governance</p>
        </div>
      </div>
    </footer>
  );
}
