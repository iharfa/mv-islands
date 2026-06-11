import Link from "next/link";
import { prisma } from "@/lib/db";
import { SectionTitle, CompletenessBar } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Atolls" };

export default async function AtollsPage() {
  const [atolls, islands, populations] = await Promise.all([
    prisma.atoll.findMany({ orderBy: { code: "asc" } }),
    prisma.island.groupBy({
      by: ["atollId"],
      _count: { _all: true },
      _avg: { overallScore: true },
      _sum: { unresolvedConflicts: true, areaSqKm: true },
    }),
    prisma.islandPopulation.findMany({
      where: { sourceSlug: "census-2022" },
      select: { total: true, island: { select: { atollId: true } } },
    }),
  ]);
  const agg = new Map(islands.map((g) => [g.atollId, g]));
  const popByAtoll = new Map<string, number>();
  for (const p of populations) {
    const id = p.island.atollId;
    if (id && p.total) popByAtoll.set(id, (popByAtoll.get(id) ?? 0) + p.total);
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 md:px-10 py-8 w-full">
      <SectionTitle>Atolls of the Maldives</SectionTitle>
      <p className="text-sm text-ink-soft mb-6">
        {atolls.length} administrative divisions. Population figures: Census 2022 (island-level, summed).
      </p>
      <div className="grid gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {atolls.map((a) => {
          const g = agg.get(a.id);
          const pop = popByAtoll.get(a.id);
          return (
            <Link key={a.id} href={`/atolls/${a.code}`} className="card p-5 hover:border-reef transition-colors block">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ocean text-lg">{a.name}</p>
                  <p className="text-xs text-ink-soft">{a.naturalAtoll}</p>
                </div>
                <span className="badge badge-info">{a.code}</span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div><dt className="label-md text-ink-soft">Islands</dt><dd className="font-bold tabular-nums">{g?._count._all ?? 0}</dd></div>
                <div><dt className="label-md text-ink-soft">Population</dt><dd className="font-bold tabular-nums">{pop?.toLocaleString() ?? "—"}</dd></div>
                <div><dt className="label-md text-ink-soft">Land area</dt><dd className="font-bold tabular-nums">{g?._sum.areaSqKm ? `${g._sum.areaSqKm.toFixed(1)} km²` : "—"}</dd></div>
                <div><dt className="label-md text-ink-soft">Conflicts</dt><dd className="font-bold tabular-nums text-danger">{g?._sum.unresolvedConflicts ?? 0}</dd></div>
              </dl>
              <div className="mt-3">
                <CompletenessBar score={Math.round(g?._avg.overallScore ?? 0)} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
