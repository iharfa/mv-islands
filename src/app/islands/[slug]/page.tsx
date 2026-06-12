import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge, ConflictBadge, StatusBadge, CompletenessBar, EmptyState, severityBadgeKind } from "@/components/ui";
import IslandMap from "@/components/IslandMap";
import FieldValueTable, { FieldValueView, prettyFieldName } from "@/components/FieldValueTable";

export const dynamic = "force-dynamic";

const TABS = [
  ["overview", "Overview"], ["geography", "Geography"], ["census", "Census & Population"],
  ["environment", "Environment"], ["infrastructure", "Infrastructure"], ["tourism", "Tourism & Use"],
  ["history", "History"], ["conflicts", "Conflicts"], ["sources", "Sources"], ["downloads", "Downloads"],
] as const;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const island = await prisma.island.findUnique({ where: { slug } });
  return { title: island ? `${island.name} — Island Profile` : "Island" };
}

function groupFields(fvs: FieldValueView[], names?: string[], prefix?: string): Map<string, FieldValueView[]> {
  const out = new Map<string, FieldValueView[]>();
  for (const fv of fvs) {
    const include = names ? names.includes(fv.fieldName) : prefix ? fv.fieldName.startsWith(prefix) : false;
    if (!include) continue;
    out.set(fv.fieldName, [...(out.get(fv.fieldName) ?? []), fv]);
  }
  if (names) {
    // preserve requested ordering
    const ordered = new Map<string, FieldValueView[]>();
    for (const n of names) if (out.has(n)) ordered.set(n, out.get(n)!);
    return ordered;
  }
  return out;
}

export default async function IslandPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab = "overview" } = await searchParams;
  const island = await prisma.island.findUnique({
    where: { slug },
    include: {
      atoll: true, names: true, geometries: true, population: true, images: true,
      conflicts: { orderBy: [{ severity: "asc" }, { detectedAt: "desc" }] },
      matchCandidates: true,
    },
  });
  if (!island) notFound();

  const fieldValues = (await prisma.fieldValue.findMany({
    where: { entityType: "island", entityId: island.id },
    include: { source: { select: { slug: true, name: true } } },
    orderBy: [{ fieldName: "asc" }, { confidenceScore: "desc" }],
  })) as unknown as FieldValueView[];

  const conflictFields = new Set(island.conflicts.filter((c) => c.status === "unresolved").map((c) => c.fieldName));
  // code → long name so the canonical atoll value renders as "Seenu (S)"; MLE is OneMap's code for the capital region
  const allAtolls = await prisma.atoll.findMany({ select: { code: true, name: true } });
  const atollNameByCode: Record<string, string> = { MLE: "Male' Region" };
  for (const a of allAtolls) atollNameByCode[a.code] = a.name;
  const altNames = island.names.filter((n) => n.nameType === "alternative").map((n) => n.name);
  const onemapGeom = island.geometries.find((g) => g.sourceSlug === "onemap" && g.geomType === "polygon");

  // Atoll comparison for census tab
  const atollPop = island.atollId
    ? await prisma.islandPopulation.aggregate({
        _sum: { total: true },
        where: { sourceSlug: "census-2022", island: { atollId: island.atollId } },
      })
    : null;
  const ownCensus = island.population.find((p) => p.sourceSlug === "census-2022");

  const sourcesUsed = new Map<string, { name: string; count: number; first: Date; last: Date }>();
  for (const fv of fieldValues) {
    const cur = sourcesUsed.get(fv.source.slug);
    if (cur) {
      cur.count++;
      if (fv.dateScraped < cur.first) cur.first = fv.dateScraped;
      if (fv.dateScraped > cur.last) cur.last = fv.dateScraped;
    } else {
      sourcesUsed.set(fv.source.slug, { name: fv.source.name, count: 1, first: fv.dateScraped, last: fv.dateScraped });
    }
  }

  const keyFact = (field: string) => fieldValues.find((f) => f.fieldName === field && f.isCanonical) ?? fieldValues.find((f) => f.fieldName === field);

  const tabHref = (t: string) => `/islands/${island.slug}?tab=${t}`;

  return (
    <div className="mx-auto max-w-[1440px] px-4 md:px-10 py-6 w-full">
      <nav className="text-xs text-ink-soft mb-3">
        <Link href="/islands" className="underline">Islands</Link>
        {island.atoll && <> / <Link href={`/atolls/${island.atoll.code}`} className="underline">{island.atoll.name}</Link></>}
        {" / "}{island.name}
      </nav>

      {/* Header */}
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-ocean">{island.name}</h1>
          {island.dhivehiName && <span className="text-xl md:text-2xl text-ink-soft" dir="rtl">{island.dhivehiName}</span>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {island.atoll && <Link href={`/atolls/${island.atoll.code}`} className="badge badge-info">{island.atoll.name} ({island.atoll.code})</Link>}
          <StatusBadge status={island.status} />
          <ConflictBadge count={island.unresolvedConflicts} />
          <span className="badge badge-neutral">updated {island.lastUpdatedAt.toISOString().slice(0, 10)}</span>
        </div>
        {altNames.length > 0 && <p className="mt-1 text-xs text-ink-soft">Also recorded as: {altNames.join(", ")}</p>}
        <div className="mt-3 max-w-sm"><CompletenessBar score={island.overallScore} label="data completeness" /></div>
      </header>

      {/* Main */}
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 space-y-4">
          <IslandMap geometry={onemapGeom?.geometry ?? null} lat={island.lat} lng={island.lng} />
          {island.images.length > 0 && (
            <div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {island.images.map((img) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={img.id} src={img.url} alt={`${island.name} — Atolls of Maldives archive image`} loading="lazy"
                    className="h-28 md:h-36 rounded-lg border border-border-subtle object-cover shrink-0" />
                ))}
              </div>
              <p className="text-[11px] text-ink-soft">Images © Atolls of Maldives (atollsofmaldives.gov.mv)</p>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-semibold text-ocean mb-3">Key facts</h2>
            <dl className="space-y-3 text-sm">
              {[["Area", island.areaSqKm != null ? `${island.areaSqKm.toFixed(2)} km²` : null, "area_ha"],
                ["Coordinates", island.lat != null ? `${island.lat.toFixed(4)}°, ${island.lng?.toFixed(4)}°` : null, "lat"],
                ["Use category", island.useCategory, "use_category"],
                ["Managing agency", keyFact("managing_agency")?.normalizedValue ?? null, "managing_agency"],
              ].map(([label, value, field]) => {
                if (!value) return null;
                const fv = keyFact(field as string);
                return (
                  <div key={label as string}>
                    <dt className="label-md text-ink-soft">{label}</dt>
                    <dd className="font-semibold">{value}</dd>
                    {fv && (
                      <dd className="text-[11px] text-ink-soft">
                        Source: <a className="underline" href={fv.sourceUrl} target="_blank" rel="noopener noreferrer">{fv.source.name}</a> · {fv.dateScraped.toISOString().slice(0, 10)}
                      </dd>
                    )}
                  </div>
                );
              })}
            </dl>
          </div>
          <div className="card p-5">
            <h2 className="font-semibold text-ocean mb-2">Source disclosure</h2>
            <ul className="text-sm space-y-1.5">
              {[...sourcesUsed.entries()].map(([slugS, s]) => (
                <li key={slugS} className="flex justify-between gap-2">
                  <span>{s.name}</span>
                  <span className="tabular-nums text-ink-soft">{s.count} values</span>
                </li>
              ))}
            </ul>
            <Link href={tabHref("sources")} className="text-xs underline text-ocean mt-2 inline-block">Full source details →</Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <nav className="tab-pills border-b border-border-subtle mb-6" aria-label="Island profile sections">
        {TABS.map(([key, label]) => (
          <Link key={key} href={tabHref(key)} scroll={false}
            className={`shrink-0 px-4 py-2.5 min-h-[44px] inline-flex items-center rounded-full text-sm font-medium transition-colors ${
              tab === key ? "bg-ocean text-white" : "bg-white border border-border-subtle text-ink-soft hover:border-reef"
            }`}>
            {label}
            {key === "conflicts" && island.unresolvedConflicts > 0 && (
              <span className="ml-1.5 badge badge-conflict">{island.unresolvedConflicts}</span>
            )}
          </Link>
        ))}
      </nav>

      {/* Tab content */}
      {tab === "overview" && (
        <FieldValueTable conflictFields={conflictFields} atollNameByCode={atollNameByCode}
          fields={groupFields(fieldValues, ["name", "dhivehi_name", "atoll", "status", "island_type", "use_category", "sector", "managing_agency", "nearest_inhabited_island", "inhabited_island_distance_km", "nearest_airport", "airport_distance_km", "nearest_resort", "resort_distance_km"])} />
      )}

      {tab === "geography" && (
        <div className="space-y-6">
          <FieldValueTable conflictFields={conflictFields}
            fields={groupFields(fieldValues, ["lat", "lng", "area_ha", "length_km", "width_km", "fcode", "island_code"])} />
          <section className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-border-subtle"><h3 className="font-semibold text-sm">Geometry records ({island.geometries.length})</h3></div>
            <table className="data-table">
              <thead><tr><th>Source</th><th>Type</th><th>Area (km²)</th><th>Fetched</th></tr></thead>
              <tbody>
                {island.geometries.map((g) => (
                  <tr key={g.id}>
                    <td>{g.sourceSlug}</td><td>{g.geomType}</td>
                    <td className="tabular-nums">{g.areaSqKm?.toFixed(3) ?? "—"}</td>
                    <td className="tabular-nums text-xs">{g.fetchedAt.toISOString().slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {tab === "census" && (
        <div className="space-y-6">
          {island.population.length ? (
            <>
              <section className="card overflow-x-auto">
                <div className="px-4 py-3 border-b border-border-subtle"><h3 className="font-semibold text-sm">Population records by source</h3></div>
                <table className="data-table">
                  <thead><tr><th>Source</th><th>Year</th><th>Total</th><th>Male</th><th>Female</th><th>Maldivian resident</th><th>Households</th><th>Fetched</th></tr></thead>
                  <tbody>
                    {island.population.map((p) => (
                      <tr key={p.id}>
                        <td>{p.sourceSlug}</td><td className="tabular-nums">{p.censusYear ?? "—"}</td>
                        <td className="tabular-nums font-semibold">{p.total?.toLocaleString() ?? "—"}</td>
                        <td className="tabular-nums">{p.male?.toLocaleString() ?? "—"}</td>
                        <td className="tabular-nums">{p.female?.toLocaleString() ?? "—"}</td>
                        <td className="tabular-nums">{p.resident?.toLocaleString() ?? "—"}</td>
                        <td className="tabular-nums">{p.households?.toLocaleString() ?? "—"}</td>
                        <td className="tabular-nums text-xs">{p.fetchedAt.toISOString().slice(0, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              {ownCensus?.total != null && atollPop?._sum.total != null && island.atoll && (
                <p className="text-sm text-ink-soft">
                  {island.name} holds <strong>{((ownCensus.total / atollPop._sum.total) * 100).toFixed(1)}%</strong> of {island.atoll.name}&apos;s
                  Census 2022 resident population ({ownCensus.total.toLocaleString()} of {atollPop._sum.total.toLocaleString()}).
                  {island.areaSqKm ? <> Density ≈ <strong>{Math.round(ownCensus.total / island.areaSqKm).toLocaleString()} /km²</strong>.</> : null}
                </p>
              )}
            </>
          ) : (
            <EmptyState title="No population records for this island"
              detail="Neither Census 2022 island tables nor StatsMap carry a population value here — typical for uninhabited and resort islands. Resort/industrial populations are aggregated separately in census publications." />
          )}
          <FieldValueTable conflictFields={conflictFields}
            fields={groupFields(fieldValues, ["population_total", "population_male", "population_female", "population_maldivian", "population_foreign", "population_2014", "households"])} />
        </div>
      )}

      {tab === "environment" && (() => {
        const env = groupFields(fieldValues, undefined, "env ::");
        const envNotes = [...groupFields(fieldValues, undefined, "notes ::")].filter(([k]) =>
          /vegetation|wet|costal|coastal|aquatic|protected/i.test(k));
        for (const [k, v] of envNotes) env.set(k, v);
        return env.size ? (
          <FieldValueTable fields={env} conflictFields={conflictFields} />
        ) : (
          <EmptyState title="No environmental records ingested for this island yet"
            detail="Environmental fields come from the Atolls of Maldives archive and (in future) EPA datasets. See the source registry for planned coverage." />
        );
      })()}

      {tab === "infrastructure" && (() => {
        const infra = groupFields(fieldValues, undefined, "infra ::");
        return infra.size ? (
          <FieldValueTable fields={infra} conflictFields={conflictFields} />
        ) : (
          <EmptyState title="No infrastructure records for this island"
            detail="Infrastructure notes come from the Atolls of Maldives archive; harbour/utility datasets from ministries are planned sources." />
        );
      })()}

      {tab === "tourism" && (
        <FieldValueTable conflictFields={conflictFields}
          fields={groupFields(fieldValues, ["resort_name", "resort_operating_state", "resort_rooms", "resort_beds", "resort_operator", "resort_owner", "use_category", "sector", "status_detail", "leased_info", "nearest_resort", "resort_distance_km", "nearest_airport", "airport_distance_km"])} />
      )}

      {tab === "history" && (() => {
        const hist = groupFields(fieldValues, undefined, "history ::");
        const notes = [...groupFields(fieldValues, undefined, "notes ::")].filter(([k]) => /historical|other/i.test(k));
        for (const [k, v] of notes) hist.set(k, v);
        const aomUrl = fieldValues.find((f) => f.source.slug === "atolls-of-maldives")?.sourceUrl;
        return (
          <div className="space-y-4">
            {aomUrl && (
              <p className="text-sm">
                Historical record: <a className="text-ocean underline" href={aomUrl} target="_blank" rel="noopener noreferrer">original Atolls of Maldives page</a>
                {" "}(raw HTML archived under <code className="bg-sand px-1 rounded text-xs">data/raw/atollsofmaldives/</code>).
              </p>
            )}
            {hist.size ? <FieldValueTable fields={hist} conflictFields={conflictFields} /> :
              <EmptyState title="No historical notes recorded" detail="The Atolls of Maldives archive has no historical entry for this island." />}
          </div>
        );
      })()}

      {tab === "conflicts" && (
        <div className="space-y-4">
          {island.conflicts.length ? island.conflicts.map((c) => {
            const values: { source: string; rawValue?: string; normalizedValue?: string; url?: string; dateScraped?: string; confidence?: number; note?: string }[] = JSON.parse(c.sourceValues);
            return (
              <section key={c.id} className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-border-subtle flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm">{prettyFieldName(c.fieldName)} <span className="text-ink-soft font-normal">· {c.conflictType}</span></h3>
                  <div className="flex gap-1.5">
                    <Badge kind={severityBadgeKind(c.severity)}>{c.severity}</Badge>
                    <Badge kind={c.status === "resolved" ? "verified" : c.status === "unresolved" ? "error" : "pending"}>{c.status}</Badge>
                  </div>
                </div>
                <div className="px-4 py-3 text-sm space-y-2">
                  <p><span className="label-md text-ink-soft">Canonical value:</span> <strong>{c.canonicalValue ?? "— none set —"}</strong></p>
                  <ul className="space-y-1">
                    {values.map((v, i) => (
                      <li key={i} className="flex flex-wrap gap-x-2 text-sm">
                        <span className="font-medium">{v.source}:</span>
                        <span>{v.note ?? v.normalizedValue ?? v.rawValue ?? "—"}</span>
                        {v.url && <a className="text-xs underline text-ocean" href={v.url} target="_blank" rel="noopener noreferrer">source</a>}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-ink-soft">
                    Confidence {Math.round(c.confidenceScore * 100)}% · detected {c.detectedAt.toISOString().slice(0, 10)}
                    {c.reviewedAt && ` · reviewed ${c.reviewedAt.toISOString().slice(0, 10)}`}
                    {c.reviewerNote && ` · note: ${c.reviewerNote}`}
                  </p>
                </div>
              </section>
            );
          }) : <EmptyState title="No conflicts detected between sources for this island" detail="All overlapping source values currently agree within tolerance." />}
        </div>
      )}

      {tab === "sources" && (
        <div className="grid gap-4 md:grid-cols-2">
          {[...sourcesUsed.entries()].map(([slugS, s]) => (
            <div key={slugS} className="card p-5">
              <h3 className="font-semibold text-ink">{s.name}</h3>
              <p className="text-sm text-ink-soft mt-1 tabular-nums">{s.count} field values · scraped {s.first.toISOString().slice(0, 10)}{s.last.getTime() !== s.first.getTime() ? ` → ${s.last.toISOString().slice(0, 10)}` : ""}</p>
              <Link href="/sources" className="text-xs underline text-ocean mt-2 inline-block">Registry entry →</Link>
            </div>
          ))}
          {island.matchCandidates.some((m) => m.needsReview) && (
            <div className="card p-5 border-warning">
              <Badge kind="pending">match under review</Badge>
              <p className="text-sm text-ink-soft mt-2">One or more source records were attached to this island with low matching confidence and await manual review.</p>
            </div>
          )}
        </div>
      )}

      {tab === "downloads" && (
        <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
          <a className="btn btn-ocean w-full" href={`/api/islands/${island.slug}/export?format=csv`}>Island CSV</a>
          <a className="btn btn-ocean w-full" href={`/api/islands/${island.slug}/export?format=geojson`}>Island GeoJSON</a>
          <a className="btn btn-ocean w-full" href={`/api/islands/${island.slug}/export?format=json`}>Full source-value JSON</a>
          <a className="btn btn-ocean w-full" href={`/api/islands/${island.slug}/export?format=conflicts`}>Conflict report (JSON)</a>
          <button className="btn btn-secondary w-full opacity-50 cursor-not-allowed" disabled title="Planned">PDF summary (coming soon)</button>
        </div>
      )}
    </div>
  );
}
