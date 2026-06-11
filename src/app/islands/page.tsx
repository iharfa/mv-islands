import Link from "next/link";
import { prisma } from "@/lib/db";
import { SectionTitle } from "@/components/ui";
import IslandListRows, { IslandRow } from "@/components/IslandListRows";

export const dynamic = "force-dynamic";
export const metadata = { title: "Island Directory" };

const PAGE_SIZE = 50;
const STATUSES = ["inhabited", "uninhabited", "resort", "industrial", "airport", "agricultural"];

export default async function IslandsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; atoll?: string; status?: string; page?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const where = {
    ...(sp.q ? { OR: [{ name: { contains: sp.q } }, { dhivehiName: { contains: sp.q } }] } : {}),
    ...(sp.atoll ? { atoll: { code: sp.atoll } } : {}),
    ...(sp.status ? { status: sp.status } : {}),
  };
  const orderBy =
    sp.sort === "area" ? { areaSqKm: "desc" as const }
    : sp.sort === "completeness" ? { overallScore: "desc" as const }
    : sp.sort === "conflicts" ? { unresolvedConflicts: "desc" as const }
    : { name: "asc" as const };

  const [islands, total, atolls, populations] = await Promise.all([
    prisma.island.findMany({
      where,
      include: { atoll: { select: { code: true, name: true } } },
      orderBy,
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.island.count({ where }),
    prisma.atoll.findMany({ orderBy: { code: "asc" } }),
    prisma.islandPopulation.findMany({ where: { sourceSlug: "census-2022" }, select: { islandId: true, total: true } }),
  ]);
  const popByIsland = new Map(populations.map((p) => [p.islandId, p.total]));

  const rows: IslandRow[] = islands.map((i) => ({
    id: i.id,
    slug: i.slug,
    name: i.name,
    dhivehiName: i.dhivehiName,
    atollName: i.atoll?.name ?? null,
    status: i.status,
    areaSqKm: i.areaSqKm,
    population: popByIsland.get(i.id) ?? null,
    overallScore: i.overallScore,
    unresolvedConflicts: i.unresolvedConflicts,
  }));

  const pages = Math.ceil(total / PAGE_SIZE);
  const qs = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...overrides })) if (v) params.set(k, String(v));
    return `?${params.toString()}`;
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 md:px-10 py-8 w-full">
      <SectionTitle>Island Directory</SectionTitle>
      <p className="text-sm text-ink-soft mb-4">{total.toLocaleString()} islands in the registry. Source: OneMap island layer (registry backbone), enriched by Census 2022, StatsMap and Atolls of Maldives.</p>

      <form method="GET" className="card p-4 mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Island name…" aria-label="Island name"
          className="border border-border-subtle rounded px-3 py-2.5 min-h-[44px] focus:border-reef outline-none lg:col-span-2" />
        <select name="atoll" defaultValue={sp.atoll ?? ""} aria-label="Atoll" className="border border-border-subtle rounded px-3 py-2.5 min-h-[44px] bg-white">
          <option value="">All atolls</option>
          {atolls.map((a) => <option key={a.code} value={a.code}>{a.name} ({a.code})</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className="border border-border-subtle rounded px-3 py-2.5 min-h-[44px] bg-white">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex gap-2">
          <select name="sort" defaultValue={sp.sort ?? ""} aria-label="Sort" className="border border-border-subtle rounded px-3 py-2.5 min-h-[44px] bg-white flex-1">
            <option value="">Sort: name</option>
            <option value="area">Sort: area</option>
            <option value="completeness">Sort: completeness</option>
            <option value="conflicts">Sort: conflicts</option>
          </select>
          <button className="btn btn-ocean" type="submit">Filter</button>
        </div>
      </form>

      <IslandListRows islands={rows} />

      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Pagination">
          {page > 1 && <Link className="btn btn-secondary" href={qs({ page: String(page - 1) })}>← Prev</Link>}
          <span className="text-sm text-ink-soft px-2 tabular-nums">Page {page} / {pages}</span>
          {page < pages && <Link className="btn btn-secondary" href={qs({ page: String(page + 1) })}>Next →</Link>}
        </nav>
      )}
    </div>
  );
}
