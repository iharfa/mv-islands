import { prisma } from "@/lib/db";

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

export async function islandsCanonicalRows() {
  const islands = await prisma.island.findMany({
    include: { atoll: true },
    orderBy: [{ atollId: "asc" }, { name: "asc" }],
  });
  return islands.map((i) => ({
    slug: i.slug,
    name: i.name,
    dhivehi_name: i.dhivehiName ?? "",
    atoll_code: i.atoll?.code ?? "",
    atoll_name: i.atoll?.name ?? "",
    status: i.status ?? "",
    island_type: i.islandType ?? "",
    use_category: i.useCategory ?? "",
    lat: i.lat ?? "",
    lng: i.lng ?? "",
    area_sq_km: i.areaSqKm ?? "",
    overall_completeness: i.overallScore,
    unresolved_conflicts: i.unresolvedConflicts,
    last_updated: i.lastUpdatedAt.toISOString(),
  }));
}

export async function islandsGeoJson() {
  const islands = await prisma.island.findMany({
    include: { atoll: true, geometries: { where: { sourceSlug: "onemap" }, take: 1 } },
  });
  return {
    type: "FeatureCollection",
    name: "maldives_islands_canonical",
    features: islands
      .filter((i) => i.geometries.length || (i.lat != null && i.lng != null))
      .map((i) => ({
        type: "Feature",
        properties: {
          slug: i.slug,
          name: i.name,
          dhivehiName: i.dhivehiName,
          atoll: i.atoll?.code,
          status: i.status,
          areaSqKm: i.areaSqKm,
          completeness: i.overallScore,
          conflicts: i.unresolvedConflicts,
        },
        geometry: i.geometries.length
          ? JSON.parse(i.geometries[0].geometry)
          : { type: "Point", coordinates: [i.lng, i.lat] },
      })),
  };
}

export async function allSourceValuesRows() {
  const fvs = await prisma.fieldValue.findMany({
    include: { source: { select: { slug: true, name: true } } },
    orderBy: [{ entityId: "asc" }, { fieldName: "asc" }],
  });
  const islands = await prisma.island.findMany({ select: { id: true, slug: true } });
  const slugById = new Map(islands.map((i) => [i.id, i.slug]));
  return fvs.map((fv) => ({
    entity_type: fv.entityType,
    island_slug: slugById.get(fv.entityId) ?? fv.entityId,
    field_name: fv.fieldName,
    source: fv.source.slug,
    raw_value: fv.rawValue ?? "",
    normalized_value: fv.normalizedValue ?? "",
    is_canonical: fv.isCanonical,
    confidence_score: fv.confidenceScore,
    verification_status: fv.verificationStatus,
    date_scraped: fv.dateScraped.toISOString(),
    date_published: fv.datePublished?.toISOString() ?? "",
    date_verified: fv.dateVerified?.toISOString() ?? "",
    source_url: fv.sourceUrl,
    notes: fv.notes ?? "",
  }));
}

export async function conflictsRows() {
  const conflicts = await prisma.dataConflict.findMany({
    include: { island: { select: { slug: true, name: true, atoll: { select: { code: true } } } } },
    orderBy: { detectedAt: "desc" },
  });
  return conflicts.map((c) => ({
    conflict_id: c.id,
    island: c.island?.name ?? "",
    island_slug: c.island?.slug ?? "",
    atoll: c.island?.atoll?.code ?? "",
    field_name: c.fieldName,
    conflict_type: c.conflictType,
    severity: c.severity,
    status: c.status,
    canonical_value: c.canonicalValue ?? "",
    source_values: c.sourceValues,
    confidence_score: c.confidenceScore,
    reviewer_note: c.reviewerNote ?? "",
    detected_at: c.detectedAt.toISOString(),
    reviewed_at: c.reviewedAt?.toISOString() ?? "",
  }));
}

/**
 * AoM data-issues dataset: every known problem with Atolls of Maldives data —
 * islands missing from the archive, and every value where AoM disagrees with
 * the registry's canonical (current) sources — so anyone reusing AoM data
 * obtained from this site knows exactly which records are affected.
 */
export async function aomDataIssuesRows() {
  const conflicts = await prisma.dataConflict.findMany({
    include: { island: { select: { slug: true, name: true, atoll: { select: { code: true } } } } },
    orderBy: [{ fieldName: "asc" }, { detectedAt: "desc" }],
  });
  const rows: Record<string, unknown>[] = [];
  for (const c of conflicts) {
    const values: { source: string; rawValue?: string; normalizedValue?: string; note?: string }[] =
      JSON.parse(c.sourceValues);
    const aom = values.find((v) => v.source === "atolls-of-maldives");
    const isMissing = c.conflictType === "missing-in-source";
    if (!aom && !isMissing) continue;
    rows.push({
      island_slug: c.island?.slug ?? "",
      island_name: c.island?.name ?? "",
      atoll: c.island?.atoll?.code ?? "",
      issue_type: isMissing ? "missing-from-aom" : `aom-${c.conflictType}`,
      field_name: c.fieldName,
      aom_value: aom ? (aom.normalizedValue ?? aom.rawValue ?? aom.note ?? "") : "no AoM page matched",
      registry_canonical_value: c.canonicalValue ?? "",
      review_status: c.status,
      reviewer_note: c.reviewerNote ?? "",
      detected_at: c.detectedAt.toISOString(),
    });
  }
  return rows;
}

export async function atollsRows() {
  const atolls = await prisma.atoll.findMany({ include: { _count: { select: { islands: true } } }, orderBy: { code: "asc" } });
  return atolls.map((a) => ({
    code: a.code,
    name: a.name,
    natural_atoll: a.naturalAtoll ?? "",
    island_count: a._count.islands,
  }));
}

export async function populationRows() {
  const pops = await prisma.islandPopulation.findMany({
    include: { island: { select: { slug: true, name: true, atoll: { select: { code: true } } } } },
    orderBy: [{ islandId: "asc" }, { sourceSlug: "asc" }],
  });
  return pops.map((p) => ({
    island_slug: p.island.slug,
    island_name: p.island.name,
    atoll: p.island.atoll?.code ?? "",
    source: p.sourceSlug,
    census_year: p.censusYear ?? "",
    total: p.total ?? "",
    male: p.male ?? "",
    female: p.female ?? "",
    resident_maldivian: p.resident ?? "",
    households: p.households ?? "",
    fetched_at: p.fetchedAt.toISOString(),
  }));
}

export async function sourceRegistryRows() {
  const sources = await prisma.source.findMany({
    include: { scrapeRuns: { orderBy: { startedAt: "desc" }, take: 1 }, _count: { select: { fieldValues: true, documents: true } } },
    orderBy: { priority: "asc" },
  });
  return sources.map((s) => ({
    slug: s.slug,
    name: s.name,
    organization: s.organization,
    url: s.url,
    dataset_type: s.datasetType,
    access_method: s.accessMethod,
    category: s.category,
    priority: s.priority,
    license: s.license ?? "",
    limitations: s.limitations ?? "",
    archive_path: s.archivePath ?? "",
    processing_script: s.processingScript ?? "",
    last_scrape: s.scrapeRuns[0]?.startedAt?.toISOString() ?? "",
    last_scrape_status: s.scrapeRuns[0]?.status ?? "",
    records_collected: s.scrapeRuns[0]?.recordsFound ?? 0,
    field_values: s._count.fieldValues,
    documents: s._count.documents,
  }));
}

/** Homepage / dashboard statistics — always pulled live from the database. */
export async function registryStats() {
  const [
    totalIslands, inhabited, resorts, industrial, atolls, conflictsTotal, conflictsUnresolved,
    landArea, lastRun, avgScore, recentIslands, sourcesCount, populationTotal,
  ] = await Promise.all([
    prisma.island.count(),
    prisma.island.count({ where: { status: "inhabited" } }),
    prisma.island.count({ where: { status: "resort" } }),
    prisma.island.count({ where: { status: "industrial" } }),
    prisma.atoll.count(),
    prisma.dataConflict.count(),
    prisma.dataConflict.count({ where: { status: "unresolved" } }),
    prisma.island.aggregate({ _sum: { areaSqKm: true } }),
    prisma.scrapeRun.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.island.aggregate({ _avg: { overallScore: true } }),
    prisma.island.findMany({ orderBy: { lastUpdatedAt: "desc" }, take: 6, include: { atoll: true } }),
    prisma.source.count(),
    prisma.islandPopulation.aggregate({ _sum: { total: true }, where: { sourceSlug: "census-2022" } }),
  ]);
  const protectedAreas = await prisma.sourceDocument.count({ where: { title: { contains: "ProtectedArea" } } });
  return {
    totalIslands, inhabited, resorts, industrial, atolls,
    conflictsTotal, conflictsUnresolved,
    totalLandAreaSqKm: Math.round((landArea._sum.areaSqKm ?? 0) * 10) / 10,
    latestSnapshotDate: lastRun?.startedAt?.toISOString().slice(0, 10) ?? null,
    completenessAvg: Math.round(avgScore._avg.overallScore ?? 0),
    recentIslands, sourcesCount, protectedAreas,
    censusPopulationTotal: populationTotal._sum.total ?? 0,
  };
}
