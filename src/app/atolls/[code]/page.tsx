import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SectionTitle, StatCard } from "@/components/ui";
import IslandListRows, { IslandRow } from "@/components/IslandListRows";

export const dynamic = "force-dynamic";

export default async function AtollPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ q?: string; status?: string; sort?: string }>;
}) {
  const { code } = await params;
  const sp = await searchParams;
  const atoll = await prisma.atoll.findFirst({ where: { code } });
  if (!atoll) notFound();

  const islands = await prisma.island.findMany({
    where: {
      atollId: atoll.id,
      ...(sp.q ? { name: { contains: sp.q } } : {}),
      ...(sp.status ? { status: sp.status } : {}),
    },
    include: { population: { where: { sourceSlug: "census-2022" }, take: 1 } },
  });

  const rows: IslandRow[] = islands.map((i) => ({
    id: i.id, slug: i.slug, name: i.name, dhivehiName: i.dhivehiName,
    atollName: atoll.name, status: i.status, areaSqKm: i.areaSqKm,
    population: i.population[0]?.total ?? null,
    overallScore: i.overallScore, unresolvedConflicts: i.unresolvedConflicts,
  }));
  rows.sort((a, b) =>
    sp.sort === "population" ? (b.population ?? -1) - (a.population ?? -1)
    : sp.sort === "area" ? (b.areaSqKm ?? -1) - (a.areaSqKm ?? -1)
    : sp.sort === "completeness" ? b.overallScore - a.overallScore
    : sp.sort === "conflicts" ? b.unresolvedConflicts - a.unresolvedConflicts
    : a.name.localeCompare(b.name),
  );

  const totalPop = rows.reduce((s, r) => s + (r.population ?? 0), 0);
  const totalArea = rows.reduce((s, r) => s + (r.areaSqKm ?? 0), 0);
  const avgScore = rows.length ? Math.round(rows.reduce((s, r) => s + r.overallScore, 0) / rows.length) : 0;
  const conflicts = rows.reduce((s, r) => s + r.unresolvedConflicts, 0);
  const byStatus = new Map<string, number>();
  for (const r of rows) byStatus.set(r.status ?? "unknown", (byStatus.get(r.status ?? "unknown") ?? 0) + 1);

  return (
    <div className="mx-auto max-w-[1440px] px-4 md:px-10 py-8 w-full">
      <nav className="text-xs text-ink-soft mb-3"><Link href="/atolls" className="underline">Atolls</Link> / {atoll.name}</nav>
      <div className="flex flex-wrap items-baseline gap-3 mb-1">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-ocean">{atoll.name}</h1>
        <span className="badge badge-info">{atoll.code}</span>
      </div>
      <p className="text-sm text-ink-soft mb-6">Natural atoll: {atoll.naturalAtoll ?? "—"}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-8">
        <StatCard label="Islands" value={rows.length} />
        <StatCard label="Census 2022 population" value={totalPop.toLocaleString()} hint="Sum of island records" />
        <StatCard label="Land area" value={`${totalArea.toFixed(1)} km²`} />
        <StatCard label="Avg completeness" value={`${avgScore}%`} />
        <StatCard label="Unresolved conflicts" value={conflicts} href={`/conflicts?atoll=${atoll.code}`} />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {[...byStatus.entries()].map(([status, n]) => (
          <span key={status} className="badge badge-neutral">{status}: {n}</span>
        ))}
      </div>

      <SectionTitle
        action={
          <span className="flex gap-2">
            <a className="btn btn-secondary" href="/api/downloads/islands.csv">CSV</a>
            <a className="btn btn-secondary" href="/api/downloads/islands.geojson">GeoJSON</a>
          </span>
        }
      >
        Islands
      </SectionTitle>

      <form method="GET" className="card p-4 mb-5 grid gap-3 sm:grid-cols-3">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Search within atoll…" aria-label="Search islands"
          className="border border-border-subtle rounded px-3 py-2.5 min-h-[44px] focus:border-reef outline-none" />
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className="border border-border-subtle rounded px-3 py-2.5 min-h-[44px] bg-white">
          <option value="">All statuses</option>
          {["inhabited", "uninhabited", "resort", "industrial", "airport", "agricultural"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <select name="sort" defaultValue={sp.sort ?? ""} aria-label="Sort" className="border border-border-subtle rounded px-3 py-2.5 min-h-[44px] bg-white flex-1">
            <option value="">Sort: name</option>
            <option value="population">Sort: population</option>
            <option value="area">Sort: area</option>
            <option value="completeness">Sort: completeness</option>
            <option value="conflicts">Sort: conflicts</option>
          </select>
          <button className="btn btn-ocean" type="submit">Apply</button>
        </div>
      </form>

      <IslandListRows islands={rows} />
    </div>
  );
}
