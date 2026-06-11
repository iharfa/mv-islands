/**
 * ETL step 2 — island matching.
 * Attaches StatsMap, Census 2022 and Atolls of Maldives records to the island
 * registry. Match ladder (per PRD): exact name → normalized name → Dhivehi name
 * → atoll+name → fuzzy → spatial proximity → manual review queue.
 * Low-confidence matches are flagged needsReview and never silently merged.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient, Island } from "@prisma/client";
import { normalizeName, nameSimilarity, resolveAtoll, parseDms, haversineKm } from "../lib/normalize";

const prisma = new PrismaClient();
const RAW = path.join(process.cwd(), "data", "raw");

const readJson = <T,>(p: string): T | null => {
  const full = path.join(RAW, p);
  return fs.existsSync(full) ? (JSON.parse(fs.readFileSync(full, "utf8")) as T) : null;
};

type IslandWithAtoll = Island & { atoll: { code: string } | null };

interface MatchResult {
  island: IslandWithAtoll;
  method: string;
  confidence: number;
}

function buildIndex(islands: IslandWithAtoll[]) {
  const byNorm = new Map<string, IslandWithAtoll[]>();
  const byDhivehi = new Map<string, IslandWithAtoll[]>();
  for (const isl of islands) {
    const n = normalizeName(isl.name);
    byNorm.set(n, [...(byNorm.get(n) ?? []), isl]);
    if (isl.dhivehiName) {
      const d = isl.dhivehiName.trim();
      byDhivehi.set(d, [...(byDhivehi.get(d) ?? []), isl]);
    }
  }
  return { byNorm, byDhivehi };
}

function matchIsland(
  islands: IslandWithAtoll[],
  index: ReturnType<typeof buildIndex>,
  name: string,
  opts: { atollCode?: string | null; dhivehi?: string | null; lat?: number | null; lng?: number | null },
): MatchResult | null {
  const norm = normalizeName(name);
  const inAtoll = (list: IslandWithAtoll[]) =>
    opts.atollCode ? list.filter((i) => i.atoll?.code?.toLowerCase() === opts.atollCode!.toLowerCase()) : list;

  // 1-2. exact / normalized name (atoll-scoped first)
  const normHits = index.byNorm.get(norm) ?? [];
  const scoped = inAtoll(normHits);
  if (scoped.length === 1) return { island: scoped[0], method: opts.atollCode ? "atoll-plus-name" : "normalized-name", confidence: 0.97 };
  if (normHits.length === 1) return { island: normHits[0], method: "normalized-name", confidence: opts.atollCode ? 0.8 : 0.92 };

  // 3. dhivehi name
  if (opts.dhivehi) {
    const dh = inAtoll(index.byDhivehi.get(opts.dhivehi.trim()) ?? []);
    if (dh.length === 1) return { island: dh[0], method: "dhivehi-name", confidence: 0.9 };
  }

  // 5. fuzzy within atoll
  const pool = opts.atollCode ? islands.filter((i) => i.atoll?.code?.toLowerCase() === opts.atollCode!.toLowerCase()) : islands;
  let best: IslandWithAtoll | null = null;
  let bestScore = 0;
  for (const isl of pool) {
    const s = nameSimilarity(isl.name, name);
    if (s > bestScore) { bestScore = s; best = isl; }
  }
  if (best && bestScore >= 0.85) return { island: best, method: "fuzzy", confidence: bestScore * 0.85 };

  // 6. spatial proximity (< 1.5 km)
  if (opts.lat != null && opts.lng != null) {
    let nearest: IslandWithAtoll | null = null;
    let nearestKm = Infinity;
    for (const isl of islands) {
      if (isl.lat == null || isl.lng == null) continue;
      const d = haversineKm(opts.lat, opts.lng, isl.lat, isl.lng);
      if (d < nearestKm) { nearestKm = d; nearest = isl; }
    }
    if (nearest && nearestKm < 1.5) {
      const nameBonus = nameSimilarity(nearest.name, name) > 0.6 ? 0.2 : 0;
      return { island: nearest, method: "spatial", confidence: Math.min(0.6 + nameBonus, 0.8) };
    }
  }
  if (best && bestScore >= 0.7) return { island: best, method: "fuzzy", confidence: bestScore * 0.7 };
  return null;
}

async function addFieldValues(
  sourceSlug: string,
  sourceUrl: string,
  islandId: string,
  fields: Record<string, { raw: unknown; normalized?: unknown; confidence?: number }>,
  fetchedAt: Date,
  rows: Record<string, unknown>[],
  sourceIds: Map<string, { id: string; docId: string | null }>,
) {
  const src = sourceIds.get(sourceSlug)!;
  for (const [fieldName, v] of Object.entries(fields)) {
    if (v.raw === null || v.raw === undefined || v.raw === "") continue;
    rows.push({
      entityType: "island",
      entityId: islandId,
      fieldName,
      sourceId: src.id,
      sourceDocumentId: src.docId,
      rawValue: String(v.raw),
      normalizedValue: String(v.normalized ?? v.raw),
      confidenceScore: v.confidence ?? 0.85,
      dateScraped: fetchedAt,
      sourceUrl,
    });
  }
}

async function main() {
  const islands = (await prisma.island.findMany({ include: { atoll: { select: { code: true } } } })) as IslandWithAtoll[];
  const index = buildIndex(islands);
  const sources = await prisma.source.findMany();
  const sourceIds = new Map<string, { id: string; docId: string | null }>();
  for (const s of sources) {
    const doc = await prisma.sourceDocument.findFirst({ where: { sourceId: s.id }, orderBy: { fetchedAt: "desc" } });
    sourceIds.set(s.slug, { id: s.id, docId: doc?.id ?? null });
  }

  const fvRows: Record<string, unknown>[] = [];
  const stats = { statsmap: 0, census: 0, aom: 0, unmatched: 0, review: 0 };

  // ---------- StatsMap (FCODE join) ----------
  const admIslands = readJson<{ features: { properties: Record<string, unknown>; geometry: unknown }[] }>("statsmap/AdministrativeIsland_2.geojson");
  const statsmapUrl = "https://statisticsmaldives.gov.mv/gismaps/statsmap/";
  const fcodeToIsland = new Map<string, IslandWithAtoll>();
  {
    const matches = await prisma.islandMatch.findMany({ where: { sourceSlug: "onemap" } });
    const byId = new Map(islands.map((i) => [i.id, i]));
    for (const m of matches) {
      const isl = byId.get(m.islandId);
      if (isl) fcodeToIsland.set(m.sourceRecordKey, isl);
    }
  }

  const statsmapLayers: [string, string][] = [
    ["AdministrativeIsland_2", "inhabited"],
    ["Uninhabited_11", "uninhabited"],
    ["OtherInhabited_12", "other-inhabited"],
    ["Resort_16", "resort"],
  ];
  for (const [layer, layerKind] of statsmapLayers) {
    const fc = readJson<{ features: { properties: Record<string, unknown>; geometry: { type: string } | null }[] }>(`statsmap/${layer}.geojson`);
    if (!fc) { console.warn(`StatsMap layer ${layer} missing — skipping`); continue; }
    const fetchedAt = new Date();
    for (const f of fc.features) {
      const p = f.properties;
      const fcode = String(p.FCODE ?? "").trim();
      const name = String(p.IslandName ?? p.islandName ?? p.Name ?? p.name ?? "").trim();
      if (!name && !fcode) continue;
      const atollCode = String(p.Atoll ?? p.atoll ?? "").trim() || null;
      const lat = typeof p.latitude === "number" ? p.latitude : parseDms(p.latitude as string);
      const lng = typeof p.longitude === "number" ? p.longitude : parseDms(p.longitude as string);

      let match: MatchResult | null = null;
      if (fcode && fcodeToIsland.has(fcode)) {
        match = { island: fcodeToIsland.get(fcode)!, method: "exact-name", confidence: 1 };
      } else if (name) {
        match = matchIsland(islands, index, name, { atollCode, lat, lng });
      }
      if (!match) { stats.unmatched++; continue; }
      const needsReview = match.confidence < 0.75;
      if (needsReview) stats.review++;
      await prisma.islandMatch.create({
        data: {
          islandId: match.island.id,
          sourceSlug: "statsmap",
          sourceRecordKey: fcode || `${layer}:${name}`,
          matchMethod: match.method,
          confidence: match.confidence,
          needsReview,
        },
      });
      stats.statsmap++;

      const fields: Record<string, { raw: unknown; normalized?: unknown; confidence?: number }> = {
        name: { raw: name, confidence: match.confidence },
        atoll: { raw: atollCode },
        lat: { raw: p.latitude, normalized: lat },
        lng: { raw: p.longitude, normalized: lng },
        status: { raw: p.category ?? layerKind, normalized: String(p.category ?? layerKind).toLowerCase() },
        island_code: { raw: p.islandCode },
        fcode: { raw: fcode || null },
      };
      if (layer === "AdministrativeIsland_2") {
        const v = (k: string) => { const x = Number(p[k]); return Number.isFinite(x) ? x : null; };
        Object.assign(fields, {
          population_total: { raw: p.v01, normalized: v("v01"), confidence: match.confidence },
          // v02=female, v03=male — verified against Census 2022 Table P5 (e.g. HA Baarah)
          population_female: { raw: p.v02, normalized: v("v02"), confidence: match.confidence },
          population_male: { raw: p.v03, normalized: v("v03"), confidence: match.confidence },
          population_maldivian: { raw: p.v04, normalized: v("v04"), confidence: match.confidence },
          households: { raw: p.v07, normalized: v("v07"), confidence: match.confidence },
        });
        if (v("v01") != null) {
          await prisma.islandPopulation.create({
            data: {
              islandId: match.island.id,
              sourceSlug: "statsmap",
              censusYear: 2022,
              total: v("v01"),
              female: v("v02"),
              male: v("v03"),
              resident: v("v04"),
              households: v("v07"),
              rawRecord: JSON.stringify(p),
              fetchedAt,
            },
          });
        }
      }
      await addFieldValues("statsmap", statsmapUrl, match.island.id, fields, fetchedAt, fvRows, sourceIds);
      if (f.geometry) {
        await prisma.islandGeometry.create({
          data: {
            islandId: match.island.id,
            sourceSlug: "statsmap",
            geomType: f.geometry.type.toLowerCase().includes("point") ? "point" : "polygon",
            geometry: JSON.stringify(f.geometry),
            fetchedAt,
          },
        });
      }
    }
    console.log(`StatsMap ${layer} matched (running total ${stats.statsmap})`);
  }

  // ---------- Census 2022 (Tables P5 + P3) ----------
  const census = readJson<{ P5?: CensusRec[]; P3?: CensusRec[] }>("mbs/census_population_by_island.json");
  interface CensusRec { atollAbr: string; island: string; total: number; female: number | null; male: number | null; maldivian: number | null; foreign: number | null; total2014?: number | null; table: string }
  if (census?.P5) {
    const fetchedAt = new Date();
    const url = "https://census.gov.mv/2022/wp-content/uploads/2023/03/Table-P5.xlsx";
    const p3ByKey = new Map((census.P3 ?? []).map((r) => [`${r.atollAbr}|${normalizeName(r.island)}`, r]));
    for (const rec of census.P5) {
      const atoll = resolveAtoll(rec.atollAbr);
      const match = matchIsland(islands, index, rec.island, { atollCode: atoll?.code ?? rec.atollAbr });
      if (!match) { stats.unmatched++; console.warn(`Census unmatched: ${rec.atollAbr} ${rec.island}`); continue; }
      const needsReview = match.confidence < 0.75;
      if (needsReview) stats.review++;
      await prisma.islandMatch.create({
        data: {
          islandId: match.island.id,
          sourceSlug: "census-2022",
          sourceRecordKey: `P5:${rec.atollAbr}:${rec.island}`,
          matchMethod: match.method,
          confidence: match.confidence,
          needsReview,
        },
      });
      stats.census++;
      const p3 = p3ByKey.get(`${rec.atollAbr}|${normalizeName(rec.island)}`);
      await prisma.islandPopulation.create({
        data: {
          islandId: match.island.id,
          sourceSlug: "census-2022",
          censusYear: 2022,
          total: rec.total,
          male: rec.male,
          female: rec.female,
          resident: rec.maldivian,
          rawRecord: JSON.stringify({ ...rec, total2014: p3?.total2014 ?? null }),
          fetchedAt,
        },
      });
      await addFieldValues("census-2022", url, match.island.id, {
        population_total: { raw: rec.total, confidence: match.confidence },
        population_male: { raw: rec.male, confidence: match.confidence },
        population_female: { raw: rec.female, confidence: match.confidence },
        population_maldivian: { raw: rec.maldivian, confidence: match.confidence },
        population_foreign: { raw: rec.foreign, confidence: match.confidence },
        population_2014: { raw: p3?.total2014 ?? null, confidence: match.confidence },
      }, fetchedAt, fvRows, sourceIds);
    }
    console.log(`Census matched ${stats.census} islands`);
  } else {
    console.warn("Census parsed JSON missing — skipping census matching");
  }

  // ---------- Atolls of Maldives ----------
  interface AomIsland {
    url: string; name: string; statusCode: string | null; atollName: string | null;
    fields: Record<string, string>; sections: Record<string, string[]>; images: string[];
  }
  const aom = readJson<AomIsland[]>("atollsofmaldives/parsed_islands.json");
  if (aom) {
    const fetchedAt = new Date();
    const FIELD_MAP: Record<string, string> = {
      "General Information :: DMS Latitude": "lat",
      "General Information :: DMS Longitude": "lng",
      "General Information :: Area (ha)": "area_ha",
      "General Information :: Length (m)": "length_km",
      "General Information :: Width (m)": "width_km",
      "General Information :: Island status": "status_detail",
      "General Information :: Leased info": "leased_info",
      "General Information :: Nearest to airport name": "nearest_airport",
      "General Information :: Proximity to airport (km)": "airport_distance_km",
      "General Information :: Nearest inhabited island": "nearest_inhabited_island",
      "General Information :: Proximity to inhabited island (km)": "inhabited_island_distance_km",
      "General Information :: Nearest resort": "nearest_resort",
      "General Information :: Proximity to resort (km)": "resort_distance_km",
      "General Information :: Purpose": "use_category",
    };
    for (const rec of aom) {
      const atoll = resolveAtoll(rec.atollName);
      const status = rec.statusCode === "I" ? "inhabited" : rec.statusCode === "U" ? "uninhabited" : rec.statusCode === "R" ? "resort" : null;
      const lat = parseDms(rec.fields["General Information :: DMS Latitude"]);
      const lng = parseDms(rec.fields["General Information :: DMS Longitude"]);
      const match = matchIsland(islands, index, rec.name, { atollCode: atoll?.code, lat, lng });
      if (!match) { stats.unmatched++; continue; }
      const needsReview = match.confidence < 0.75;
      if (needsReview) stats.review++;
      await prisma.islandMatch.create({
        data: {
          islandId: match.island.id,
          sourceSlug: "atolls-of-maldives",
          sourceRecordKey: rec.url,
          matchMethod: match.method,
          confidence: match.confidence,
          needsReview,
        },
      });
      stats.aom++;

      const fields: Record<string, { raw: unknown; normalized?: unknown; confidence?: number }> = {
        name: { raw: rec.name, confidence: match.confidence },
        atoll: { raw: rec.atollName, normalized: atoll?.code },
        status: { raw: rec.statusCode, normalized: status },
        lat: { raw: rec.fields["General Information :: DMS Latitude"], normalized: lat },
        lng: { raw: rec.fields["General Information :: DMS Longitude"], normalized: lng },
      };
      for (const [label, fieldName] of Object.entries(FIELD_MAP)) {
        if (fieldName === "lat" || fieldName === "lng") continue;
        if (rec.fields[label]) fields[fieldName] = { raw: rec.fields[label], confidence: 0.7 };
      }
      // Environment / infrastructure / history fields keep their section-prefixed label
      for (const [label, value] of Object.entries(rec.fields)) {
        if (FIELD_MAP[label]) continue;
        const section = label.split(" :: ")[0];
        if (/Soil|Vegetation|Wet Lands|Costal|Aquatic|Protected|Invasive|birds|Animal/i.test(section)) {
          fields[`env :: ${label}`] = { raw: value, confidence: 0.7 };
        } else if (/Infrastructure|Processing|Field Area/i.test(section)) {
          fields[`infra :: ${label}`] = { raw: value, confidence: 0.7 };
        } else if (/Historical/i.test(section)) {
          fields[`history :: ${label}`] = { raw: value, confidence: 0.7 };
        } else {
          fields[`other :: ${label}`] = { raw: value, confidence: 0.6 };
        }
      }
      for (const [section, paras] of Object.entries(rec.sections)) {
        fields[`notes :: ${section}`] = { raw: paras.join("\n\n"), confidence: 0.7 };
      }
      await addFieldValues("atolls-of-maldives", rec.url, match.island.id, fields, fetchedAt, fvRows, sourceIds);

      for (const img of rec.images.slice(0, 12)) {
        await prisma.islandImage.create({
          data: { islandId: match.island.id, url: img, sourceSlug: "atolls-of-maldives" },
        });
      }
      await prisma.islandName.create({
        data: { islandId: match.island.id, name: rec.name, nameType: match.island.name === rec.name ? "official" : "alternative", sourceSlug: "atolls-of-maldives" },
      });
    }
    console.log(`Atolls of Maldives matched ${stats.aom} islands`);
  } else {
    console.warn("Atolls of Maldives parsed JSON missing — skipping (partial data mode)");
  }

  for (let i = 0; i < fvRows.length; i += 1000) {
    await prisma.fieldValue.createMany({ data: fvRows.slice(i, i + 1000) as never });
  }

  await prisma.auditLog.create({
    data: {
      actor: "system",
      action: "etl:match-islands",
      detail: JSON.stringify(stats),
    },
  });
  console.log("Matching complete:", stats, `(${fvRows.length} field values added)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); process.exit(1); });
