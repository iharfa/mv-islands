/**
 * ETL step 1 — normalize.
 * Rebuilds the derived registry (atolls, islands, geometries, names, source-first
 * field values) from archived raw data. Raw archives are never modified; this
 * step is fully repeatable. The OneMap island layer is the registry backbone
 * (it has the most complete island universe at 1,561 features keyed by FCODE).
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { ATOLLS, resolveAtoll, parseDms, slugify } from "../lib/normalize";

const prisma = new PrismaClient();
const RAW = path.join(process.cwd(), "data", "raw");

function readJson<T>(p: string): T | null {
  const full = path.join(RAW, p);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, "utf8")) as T;
}

interface GeoFeature {
  type: string;
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown } | null;
}
interface FC { features: GeoFeature[] }

async function main() {
  const onemap = readJson<FC>("onemap/islands_all.geojson");
  if (!onemap) {
    console.error("Missing data/raw/onemap/islands_all.geojson — run npm run scrape:onemap first.");
    console.error("Continuing with whatever raw data exists is not possible: OneMap is the registry backbone.");
    process.exit(1);
  }
  const statsmapAtolls = readJson<FC>("statsmap/AdministrativeAtoll_21.geojson");

  const onemapSource = await prisma.source.findUniqueOrThrow({ where: { slug: "onemap" } });
  const onemapDoc = await prisma.sourceDocument.findFirst({
    where: { sourceId: onemapSource.id },
    orderBy: { fetchedAt: "desc" },
  });

  console.log("Clearing derived tables (raw archives untouched)…");
  await prisma.fieldValue.deleteMany();
  await prisma.dataConflict.deleteMany();
  await prisma.islandMatch.deleteMany();
  await prisma.islandName.deleteMany();
  await prisma.islandGeometry.deleteMany();
  await prisma.islandPopulation.deleteMany();
  await prisma.islandImage.deleteMany();
  await prisma.island.deleteMany();
  await prisma.atoll.deleteMany();

  // --- Atolls ---
  const atollIdByCode = new Map<string, string>();
  for (const def of ATOLLS) {
    let geometry: string | null = null;
    let centroid: { lat: number | null; lng: number | null } = { lat: null, lng: null };
    if (statsmapAtolls) {
      const feat = statsmapAtolls.features.find((f) => {
        const p = f.properties;
        return (
          String(p.ATOLL ?? p.Atoll ?? p.atoll ?? p.name ?? p.NAME ?? "").toLowerCase() ===
            def.code.toLowerCase() ||
          resolveAtoll(String(p.ATOLL ?? p.Atoll ?? p.atoll ?? p.name ?? p.NAME ?? ""))?.code === def.code
        );
      });
      if (feat?.geometry) geometry = JSON.stringify(feat.geometry);
    }
    const atoll = await prisma.atoll.create({
      data: {
        code: def.code,
        name: def.name,
        naturalAtoll: def.naturalName,
        geometry,
        centroidLat: centroid.lat,
        centroidLng: centroid.lng,
      },
    });
    atollIdByCode.set(def.code, atoll.id);
  }
  console.log(`Created ${atollIdByCode.size} atolls`);

  // --- Islands from OneMap ---
  const fetchedAt = onemapDoc?.fetchedAt ?? new Date();
  const usedSlugs = new Set<string>();
  let created = 0;
  const fieldValueRows: Record<string, unknown>[] = [];

  for (const f of onemap.features) {
    const p = f.properties;
    const name = String(p.islandName ?? "").trim();
    if (!name) continue;
    const atollDef = resolveAtoll(String(p.atoll ?? ""));
    const lat = parseDms(p.latitude as string);
    const lng = parseDms(p.longitude as string);
    const fcode = String(p.FCODE ?? "").trim() || null;
    let slug = slugify(name, atollDef?.code);
    if (usedSlugs.has(slug)) slug = `${slug}-${fcode ?? Math.random().toString(36).slice(2, 6)}`;
    usedSlugs.add(slug);

    const category = String(p.category ?? "").trim();
    // OneMap categories: Residential Island, Tourism Island, Uninhabited Island,
    // Industrial Island, Institutional Island
    const status = /residential/i.test(category) || (/(^|[^n])inhabited island/i.test(category))
      ? "inhabited"
      : /tourism|resort/i.test(category) ? "resort"
      : /industrial/i.test(category) ? "industrial"
      : /institutional/i.test(category) ? "institutional"
      : /airport/i.test(category) ? "airport"
      : /agricultur/i.test(category) ? "agricultural"
      : /uninhabited/i.test(category) ? "uninhabited"
      : category.trim() ? category.trim().toLowerCase() : null;

    const areaHa = typeof p.Area_ha === "number" ? p.Area_ha : Number(p.Area_ha) || null;
    const island = await prisma.island.create({
      data: {
        slug,
        name,
        dhivehiName: (p.islandNa_1 as string)?.trim() || null,
        atollId: atollDef ? atollIdByCode.get(atollDef.code) : null,
        status,
        islandType: category || null,
        useCategory: (p.Usage as string)?.trim() || null,
        lat,
        lng,
        areaSqKm: areaHa ? areaHa / 100 : null,
      },
    });
    created++;

    await prisma.islandName.createMany({
      data: [
        { islandId: island.id, name, nameType: "official", sourceSlug: "onemap" },
        ...(island.dhivehiName
          ? [{ islandId: island.id, name: island.dhivehiName, nameType: "dhivehi", sourceSlug: "onemap" }]
          : []),
      ],
    });

    if (f.geometry) {
      await prisma.islandGeometry.create({
        data: {
          islandId: island.id,
          sourceSlug: "onemap",
          geomType: "polygon",
          geometry: JSON.stringify(f.geometry),
          areaSqKm: areaHa ? areaHa / 100 : null,
          fetchedAt,
        },
      });
    }

    if (fcode) {
      await prisma.islandMatch.create({
        data: {
          islandId: island.id,
          sourceSlug: "onemap",
          sourceRecordKey: fcode,
          matchMethod: "exact-name",
          confidence: 1,
        },
      });
    }

    const fields: Record<string, unknown> = {
      name,
      dhivehi_name: island.dhivehiName,
      atoll: atollDef?.code ?? String(p.atoll ?? ""),
      status,
      island_type: category || null,
      use_category: island.useCategory,
      sector: (p.Sector as string)?.trim() || null,
      managing_agency: (p.PrimAgency as string)?.trim() || null,
      lat,
      lng,
      area_ha: areaHa,
      fcode,
      capital: p.capital === "Y" ? "yes" : null,
    };
    for (const [fieldName, value] of Object.entries(fields)) {
      if (value === null || value === undefined || value === "") continue;
      fieldValueRows.push({
        entityType: "island",
        entityId: island.id,
        fieldName,
        sourceId: onemapSource.id,
        sourceDocumentId: onemapDoc?.id ?? null,
        rawValue: fieldName === "lat" ? String(p.latitude) : fieldName === "lng" ? String(p.longitude) : String(value),
        normalizedValue: String(value),
        confidenceScore: 0.9,
        dateScraped: fetchedAt,
        sourceUrl:
          "https://services7.arcgis.com/yvCbn3q8PPtPLZIM/arcgis/rest/services/island_20240509/FeatureServer/0",
      });
    }
    if (created % 250 === 0) console.log(`…${created} islands`);
  }

  // Bulk insert field values in chunks
  for (let i = 0; i < fieldValueRows.length; i += 1000) {
    await prisma.fieldValue.createMany({ data: fieldValueRows.slice(i, i + 1000) as never });
  }

  await prisma.auditLog.create({
    data: {
      actor: "system",
      action: "etl:normalize",
      detail: `Rebuilt registry: ${created} islands, ${fieldValueRows.length} field values from OneMap backbone`,
    },
  });
  console.log(`Done. ${created} islands, ${fieldValueRows.length} field values.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
