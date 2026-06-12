import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { SectionTitle, Badge, severityBadgeKind } from "@/components/ui";
import { prettyFieldName } from "@/components/FieldValueTable";
import AdminLogin from "@/components/AdminLogin";
import DuplicateResolveActions from "@/components/DuplicateResolveActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Duplicate Review" };

type IslandFull = NonNullable<Awaited<ReturnType<typeof loadIsland>>>;

function loadIsland(id: string) {
  return prisma.island.findUnique({
    where: { id },
    include: {
      atoll: true,
      population: { orderBy: { censusYear: "desc" } },
      geometries: { select: { sourceSlug: true, geomType: true, areaSqKm: true } },
      names: true,
      matchCandidates: { select: { sourceSlug: true, matchMethod: true, confidence: true } },
    },
  });
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  return String(v);
}

export default async function DuplicateReviewPage(ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return <AdminLogin />;

  const { id } = await ctx.params;
  const conflict = await prisma.dataConflict.findUnique({ where: { id } });
  if (!conflict || conflict.conflictType !== "duplicate" || !conflict.islandId) notFound();

  const note: string = JSON.parse(conflict.sourceValues)[0]?.note ?? "";
  const otherId = /also island (\w+)/.exec(note)?.[1];
  if (!otherId) notFound();

  const [a, b] = await Promise.all([loadIsland(conflict.islandId), loadIsland(otherId)]);
  if (!a || !b) notFound();
  const pair: [IslandFull, IslandFull] = [a, b];

  // Canonical field values for both islands, side by side
  const fieldValues = await prisma.fieldValue.findMany({
    where: { entityType: "island", entityId: { in: [a.id, b.id] }, isCanonical: true },
    include: { source: { select: { slug: true, name: true } } },
    orderBy: { fieldName: "asc" },
  });
  const fieldNames = [...new Set(fieldValues.map((fv) => fv.fieldName))].sort();
  const valueFor = (islandId: string, field: string) =>
    fieldValues.find((fv) => fv.entityId === islandId && fv.fieldName === field);

  // Distance between the two records, when both have coordinates
  let distanceKm: number | null = null;
  if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
    const dLat = (a.lat - b.lat) * 111;
    const dLng = (a.lng - b.lng) * 111 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
    distanceKm = Math.sqrt(dLat * dLat + dLng * dLng);
  }

  const summaryRows: [string, (i: IslandFull) => React.ReactNode][] = [
    ["OneMap code", (i) => i.slug.split("-").pop()?.toUpperCase()],
    ["Status", (i) => fmt(i.status)],
    ["Island type", (i) => fmt(i.islandType)],
    ["Use category", (i) => fmt(i.useCategory)],
    ["Latitude", (i) => fmt(i.lat)],
    ["Longitude", (i) => fmt(i.lng)],
    ["Area (km²)", (i) => fmt(i.areaSqKm)],
    ["Population (latest)", (i) => fmt(i.population[0]?.total)],
    ["Geometries", (i) => i.geometries.map((g) => `${g.sourceSlug} (${g.geomType})`).join(", ") || "—"],
    ["Alternative names", (i) => i.names.map((n) => n.name).join(", ") || "—"],
    ["Source matches", (i) => i.matchCandidates.map((m) => `${m.sourceSlug} ${Math.round(m.confidence * 100)}%`).join(", ") || "—"],
    ["Completeness score", (i) => `${i.overallScore}%`],
    ["Unresolved conflicts", (i) => i.unresolvedConflicts],
  ];

  return (
    <div className="mx-auto max-w-[1100px] px-4 md:px-10 py-8 w-full">
      <SectionTitle>Duplicate review · {a.name}</SectionTitle>
      <p className="text-sm text-ink-soft mb-2 max-w-3xl">
        Two registry records share the name <strong>{a.name}</strong> in{" "}
        <strong>{a.atoll?.name ?? "unknown atoll"}</strong>. Compare them below and record which one is the
        primary record — or confirm they are genuinely distinct islands.
      </p>
      <p className="text-xs text-ink-soft mb-6">
        <Badge kind={severityBadgeKind(conflict.severity)}>{conflict.severity}</Badge>
        <span className="ml-2">conflict {conflict.id.slice(-6)} · detected {conflict.detectedAt.toISOString().slice(0, 10)}</span>
        {distanceKm != null && (
          <span className="ml-2 tabular-nums">
            · records are <strong>{distanceKm.toFixed(2)} km</strong> apart
            {distanceKm > 1 ? " (likely two distinct islands)" : " (likely the same island)"}
          </span>
        )}
      </p>

      <div className="card overflow-x-auto mb-6">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th className="w-[220px]">Field</th>
              {pair.map((i) => (
                <th key={i.id}>
                  <Link className="text-ocean underline" href={`/islands/${i.slug}`} target="_blank">
                    {i.name} ({i.slug})
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summaryRows.map(([label, render]) => {
              const va = render(a), vb = render(b);
              const differs = String(va) !== String(vb);
              return (
                <tr key={label} className={differs ? "bg-sand/60" : ""}>
                  <td className="font-medium text-xs">{label}{differs && <span className="ml-1 text-coral">≠</span>}</td>
                  <td className="text-sm">{va}</td>
                  <td className="text-sm">{vb}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {fieldNames.length > 0 && (
        <details className="card p-4 mb-6">
          <summary className="font-semibold text-ocean cursor-pointer min-h-[44px] flex items-center">
            All canonical source values ({fieldNames.length} fields)
          </summary>
          <div className="overflow-x-auto mt-2">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="w-[220px]">Field</th>
                  <th>{a.slug}</th>
                  <th>{b.slug}</th>
                </tr>
              </thead>
              <tbody>
                {fieldNames.map((f) => {
                  const va = valueFor(a.id, f), vb = valueFor(b.id, f);
                  const sa = va?.normalizedValue ?? va?.rawValue ?? "—";
                  const sb = vb?.normalizedValue ?? vb?.rawValue ?? "—";
                  return (
                    <tr key={f} className={sa !== sb ? "bg-sand/60" : ""}>
                      <td className="font-medium text-xs">{prettyFieldName(f)}</td>
                      <td className="text-sm max-w-[300px] truncate" title={sa}>{sa} {va && <span className="text-[10px] text-ink-soft">({va.source.slug})</span>}</td>
                      <td className="text-sm max-w-[300px] truncate" title={sb}>{sb} {vb && <span className="text-[10px] text-ink-soft">({vb.source.slug})</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <DuplicateResolveActions
        conflictId={conflict.id}
        islands={[
          { id: a.id, slug: a.slug, name: a.name },
          { id: b.id, slug: b.slug, name: b.name },
        ]}
      />

      <p className="mt-6 text-sm">
        <Link className="text-ocean underline" href="/admin">← Back to admin dashboard</Link>
      </p>
    </div>
  );
}
