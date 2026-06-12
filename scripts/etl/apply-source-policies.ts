/**
 * ETL step 4 — apply the registry's source-primacy policies.
 *
 * Policies (set by the registry steward, 2026-06-12):
 *
 * 1. OneMap-primary (geography & naming). OneMap Maldives is the national
 *    geospatial portal maintained by the government agency tasked with
 *    surveying, so the registry treats it as a verified source:
 *    - every OneMap field value is marked `verified`;
 *    - name conflicts where OneMap provides the canonical value are resolved
 *      in OneMap's favour;
 *    - small coordinate disagreements (≤ COORD_RESOLVE_KM — typical
 *      survey/centroid variation) are resolved in OneMap's favour; larger
 *      spreads usually indicate a wrong cross-source match and are escalated
 *      to `needs_external_confirmation` instead.
 *
 * 2. Census-2022-primary (population). Census 2022 is the published census;
 *    StatsMap is a derived web-map visualisation that can lag it (both are
 *    published by MBS). The registry treats the census as the verified
 *    primary source for population values:
 *    - every Census 2022 field value is marked `verified`;
 *    - population conflicts where the census provides the canonical value
 *      are resolved in its favour. Disagreeing values stay published.
 *
 * Resolutions only record the review — the disagreement itself remains
 * published with every source's value, per registry principles.
 *
 * Run after etl:detect-conflicts (which resets all conflict statuses).
 * Only `unresolved` conflicts are touched, so manual review decisions made
 * between ETL runs are never overwritten by this script.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const COORD_RESOLVE_KM = 5;
const KM_PER_DEGREE = 111; // good enough at the equator, which the Maldives straddles

const POPULATION_FIELDS = [
  "population_total",
  "population_male",
  "population_female",
  "population_maldivian",
  "population_foreign",
  "households",
];

type SourceValue = { source: string; rawValue?: string | null; normalizedValue?: string | null };

function sourceValue(values: SourceValue[], slug: string): string | null {
  const v = values.find((x) => x.source === slug);
  return v ? (v.normalizedValue ?? v.rawValue ?? null) : null;
}

function sameValue(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return false;
  const na = Number(a), nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

async function markSourceVerified(slug: string): Promise<number> {
  const source = await prisma.source.findUnique({ where: { slug } });
  if (!source) throw new Error(`Source ${slug} not registered — run db:seed first`);
  const res = await prisma.fieldValue.updateMany({
    where: { sourceId: source.id, verificationStatus: { not: "verified" } },
    data: { verificationStatus: "verified", dateVerified: new Date() },
  });
  console.log(`Marked ${res.count} ${slug} field values as verified.`);
  return res.count;
}

async function main() {
  const now = new Date();
  const touchedIslands = new Set<string>();

  // ---------------- Policy 1: OneMap primary ----------------
  const onemapVerified = await markSourceVerified("onemap");
  const ONEMAP_NOTE =
    "OneMap (national geospatial portal, government surveying agency) is the registry's verified primary source";

  let nameResolved = 0;
  const nameConflicts = await prisma.dataConflict.findMany({
    where: { status: "unresolved", conflictType: "value-mismatch", fieldName: { in: ["name", "dhivehi_name"] } },
  });
  for (const c of nameConflicts) {
    const om = sourceValue(JSON.parse(c.sourceValues), "onemap");
    if (!sameValue(c.canonicalValue, om)) continue;
    await prisma.dataConflict.update({
      where: { id: c.id },
      data: {
        status: "resolved",
        reviewedBy: "policy:onemap-primary",
        reviewedAt: now,
        reviewerNote: `${ONEMAP_NOTE}; OneMap naming confirmed as canonical. Other sources' values remain published.`,
      },
    });
    if (c.islandId) touchedIslands.add(c.islandId);
    nameResolved++;
  }

  let coordResolved = 0;
  let coordEscalated = 0;
  const coordConflicts = await prisma.dataConflict.findMany({
    where: { status: "unresolved", conflictType: "value-mismatch", fieldName: { in: ["lat", "lng"] } },
  });
  for (const c of coordConflicts) {
    const values: SourceValue[] = JSON.parse(c.sourceValues);
    const om = sourceValue(values, "onemap");
    if (!sameValue(c.canonicalValue, om)) continue;
    const omNum = Number(om);
    const others = values
      .filter((v) => v.source !== "onemap")
      .map((v) => Number(v.normalizedValue ?? v.rawValue))
      .filter(Number.isFinite);
    if (!others.length || !Number.isFinite(omNum)) continue;
    const maxDeltaKm = Math.max(...others.map((n) => Math.abs(n - omNum))) * KM_PER_DEGREE;

    if (maxDeltaKm <= COORD_RESOLVE_KM) {
      await prisma.dataConflict.update({
        where: { id: c.id },
        data: {
          status: "resolved",
          reviewedBy: "policy:onemap-primary",
          reviewedAt: now,
          reviewerNote: `${ONEMAP_NOTE}; coordinate spread ${maxDeltaKm.toFixed(2)} km is within normal survey/centroid variation. OneMap coordinates confirmed as canonical.`,
        },
      });
      coordResolved++;
    } else {
      await prisma.dataConflict.update({
        where: { id: c.id },
        data: {
          status: "needs_external_confirmation",
          reviewedBy: "policy:onemap-primary",
          reviewedAt: now,
          reviewerNote: `Coordinate spread ${maxDeltaKm.toFixed(2)} km exceeds ${COORD_RESOLVE_KM} km — likely a wrong cross-source match rather than survey variation. Needs confirmation against source records.`,
        },
      });
      coordEscalated++;
    }
    if (c.islandId) touchedIslands.add(c.islandId);
  }

  // ---------------- Policy 2: Census 2022 primary ----------------
  const censusVerified = await markSourceVerified("census-2022");
  const CENSUS_NOTE =
    "Census 2022 is the published census and the registry's verified primary source for population; StatsMap visualises derived values and may lag it";

  let populationResolved = 0;
  const popConflicts = await prisma.dataConflict.findMany({
    where: { status: "unresolved", conflictType: "value-mismatch", fieldName: { in: POPULATION_FIELDS } },
  });
  for (const c of popConflicts) {
    const census = sourceValue(JSON.parse(c.sourceValues), "census-2022");
    if (!sameValue(c.canonicalValue, census)) continue;
    await prisma.dataConflict.update({
      where: { id: c.id },
      data: {
        status: "resolved",
        reviewedBy: "policy:census-2022-primary",
        reviewedAt: now,
        reviewerNote: `${CENSUS_NOTE}. Census value confirmed as canonical; other sources' values remain published.`,
      },
    });
    if (c.islandId) touchedIslands.add(c.islandId);
    populationResolved++;
  }

  // ---------------- Sync + audit ----------------
  for (const islandId of touchedIslands) {
    const unresolved = await prisma.dataConflict.count({ where: { islandId, status: "unresolved" } });
    await prisma.island.update({ where: { id: islandId }, data: { unresolvedConflicts: unresolved } });
  }

  await prisma.auditLog.create({
    data: {
      actor: "policy:source-primacy",
      action: "etl:apply-source-policies",
      detail:
        `OneMap: ${onemapVerified} values verified, ${nameResolved} name conflicts resolved, ` +
        `${coordResolved} coordinate resolved (≤${COORD_RESOLVE_KM} km), ${coordEscalated} escalated. ` +
        `Census 2022: ${censusVerified} values verified, ${populationResolved} population conflicts resolved.`,
    },
  });

  console.log(
    `Done. OneMap — name: ${nameResolved}, coords resolved: ${coordResolved}, escalated: ${coordEscalated}. ` +
      `Census 2022 — population: ${populationResolved}. Islands updated: ${touchedIslands.size}.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
