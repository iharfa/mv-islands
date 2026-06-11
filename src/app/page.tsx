import Link from "next/link";
import { registryStats } from "@/lib/exports";
import IslandSearch from "@/components/IslandSearch";
import { ConflictBadge, StatCard, StatusBadge, CompletenessBar, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const stats = await registryStats();

  return (
    <div>
      {/* Hero */}
      <section className="bg-ocean text-white">
        <div className="mx-auto max-w-[1440px] px-4 md:px-10 py-12 md:py-20 text-center">
          <p className="label-md text-reef mb-3">Maldives Island Registry · Open Data Portal</p>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight max-w-3xl mx-auto">
            Public Geospatial Resources for the Republic of Maldives
          </h1>
          <p className="mt-4 text-white/75 max-w-2xl mx-auto text-sm md:text-base">
            A consolidated island registry combining OneMap, the Census 2022, MBS StatsMap and the
            Atolls of Maldives archive — with full source disclosure for every public data point.
          </p>
          <div className="mt-8 flex justify-center">
            <IslandSearch />
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/map" className="btn btn-primary">Open Map Explorer</Link>
            <Link href="/downloads" className="btn bg-white/10 text-white border border-white/30 hover:bg-white/20">Data Downloads</Link>
            <Link href="/conflicts" className="btn bg-white/10 text-white border border-white/30 hover:bg-white/20">Data Conflicts</Link>
            <Link href="/api-docs" className="btn bg-white/10 text-white border border-white/30 hover:bg-white/20">API</Link>
          </div>
        </div>
      </section>

      {/* Quick stats — all live from the database */}
      <section className="mx-auto max-w-[1440px] px-4 md:px-10 -mt-8 md:-mt-10 relative z-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          <StatCard label="Total islands" value={stats.totalIslands.toLocaleString()} href="/islands" />
          <StatCard label="Inhabited" value={stats.inhabited.toLocaleString()} href="/islands?status=inhabited" />
          <StatCard label="Resort islands" value={stats.resorts.toLocaleString()} href="/islands?status=resort" />
          <StatCard label="Industrial" value={stats.industrial.toLocaleString()} href="/islands?status=industrial" />
          <StatCard label="Land area" value={`${stats.totalLandAreaSqKm.toLocaleString()} km²`} hint="Sum of registry areas" />
          <StatCard label="Census 2022 population" value={stats.censusPopulationTotal.toLocaleString()} hint="Resident, by island" />
        </div>
      </section>

      {/* Data health */}
      <section className="mx-auto max-w-[1440px] px-4 md:px-10 py-10">
        <div className="grid sm:grid-cols-3 gap-3 md:gap-4">
          <div className="card p-5">
            <p className="label-md text-ink-soft mb-2">Data completeness</p>
            <CompletenessBar score={stats.completenessAvg} />
            <p className="mt-2 text-xs text-ink-soft">Average across {stats.totalIslands.toLocaleString()} island records</p>
          </div>
          <Link href="/conflicts" className="card p-5 hover:border-reef transition-colors">
            <p className="label-md text-ink-soft mb-2">Unresolved conflicts</p>
            <p className="text-2xl font-bold text-danger tabular-nums">{stats.conflictsUnresolved.toLocaleString()}</p>
            <p className="mt-1 text-xs text-ink-soft">of {stats.conflictsTotal.toLocaleString()} detected — never silently resolved</p>
          </Link>
          <div className="card p-5">
            <p className="label-md text-ink-soft mb-2">Latest data snapshot</p>
            <p className="text-2xl font-bold text-ocean tabular-nums">{stats.latestSnapshotDate ?? "—"}</p>
            <p className="mt-1 text-xs text-ink-soft">{stats.sourcesCount} registered sources · <Link href="/sources" className="underline">source registry</Link></p>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="bg-ocean-deep text-white">
        <div className="mx-auto max-w-[1440px] px-4 md:px-10 py-12 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <p className="label-md text-reef mb-2">Coalition for Open Governance</p>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Transparency Through Open Data</h2>
            <p className="mt-3 text-white/75 text-sm md:text-base leading-relaxed">
              Every value in this registry keeps its original source record: what each source says,
              which value is shown as canonical and why, when it was scraped, and what still needs
              review. When sources disagree, the conflict is published — never overwritten.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/sources" className="btn btn-primary">Source Registry</Link>
              <Link href="/conflicts" className="btn bg-white/10 text-white border border-white/30 hover:bg-white/20">See open conflicts</Link>
            </div>
          </div>
          <blockquote className="border-l-2 border-reef pl-5 text-white/85 italic leading-relaxed">
            “Open Data redistributes power that has been consolidated by a few. Those who benefit
            from secrecy will fight it. They will lose. Open Data is inevitable, question is will
            you proactively embrace it?”
            <footer className="mt-3 not-italic text-xs font-semibold text-reef">
              AHMED AFRAH ISMAIL — Coalition for Open Governance
            </footer>
          </blockquote>
        </div>
      </section>

      {/* Recently updated */}
      <section className="mx-auto max-w-[1440px] px-4 md:px-10 py-10">
        <SectionTitle action={<Link className="btn btn-ghost" href="/islands">All islands →</Link>}>
          Recently Updated Island Records
        </SectionTitle>
        <div className="hidden md:block card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr><th>Island</th><th>Atoll</th><th>Status</th><th>Completeness</th><th>Conflicts</th><th>Updated</th></tr>
            </thead>
            <tbody>
              {stats.recentIslands.map((i) => (
                <tr key={i.id}>
                  <td><Link className="font-semibold text-ocean hover:underline" href={`/islands/${i.slug}`}>{i.name}</Link></td>
                  <td>{i.atoll?.name ?? "—"}</td>
                  <td><StatusBadge status={i.status} /></td>
                  <td className="min-w-[140px]"><CompletenessBar score={i.overallScore} /></td>
                  <td>{i.unresolvedConflicts ? <ConflictBadge count={i.unresolvedConflicts} /> : <span className="text-xs text-ink-soft">none</span>}</td>
                  <td className="text-xs text-ink-soft tabular-nums">{i.lastUpdatedAt.toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="md:hidden space-y-3">
          {stats.recentIslands.map((i) => (
            <li key={i.id}>
              <Link href={`/islands/${i.slug}`} className="card p-4 block">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-ocean">{i.name}</span>
                  <StatusBadge status={i.status} />
                </div>
                <p className="text-xs text-ink-soft mt-1">{i.atoll?.name ?? "—"} · updated {i.lastUpdatedAt.toISOString().slice(0, 10)}</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <CompletenessBar score={i.overallScore} />
                  <ConflictBadge count={i.unresolvedConflicts} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
