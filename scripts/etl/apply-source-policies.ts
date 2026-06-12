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
 * 3. Atoll naming conventions. OneMap records atolls by code ("S", "ADh"),
 *    StatsMap/AoM spell them out ("Seenu", "Alifu Dhaalu") — most atoll
 *    conflicts are the same atoll written two ways. When every source value
 *    maps to the same atoll via the Atoll registry (code or name), the
 *    conflict is resolved in OneMap's favour; the UI displays the long name
 *    with the code in brackets ("Seenu (S)"). Values that map to different
 *    atolls are genuine assignment disagreements and stay unresolved.
 *
 * 4. Status vocabulary (steward direction 2026-06-12). StatsMap, a census
 *    map, labels islands without resident administrative population
 *    "uninhabited" even when they are resorts/industrial/institutional
 *    islands. OneMap's finer breakdown is preferred. Conflicts where OneMap
 *    says resort/industrial/institutional and every other source says either
 *    the same or "uninhabited" are resolved in OneMap's favour. The
 *    inhabited-vs-other-inhabited group and disagreements involving other
 *    statuses are left for individual steward review.
 *
 * 5. Island area (steward direction 2026-06-12). OneMap areas come from
 *    current survey polygons; AoM areas from a historical archive that
 *    predates extensive land reclamation. All area conflicts where OneMap
 *    provides the canonical value are resolved in OneMap's favour.
 *
 * 6. Use category (steward direction 2026-06-12). AoM and OneMap use
 *    different vocabularies for the same use ("Resorts" vs "Resort",
 *    "Mariculture" vs "Aquaculture") and AoM's lease data is stale. OneMap's
 *    value is treated as correct for this bucket.
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

  // ---------------- Policy 3: Atoll naming conventions ----------------
  const atolls = await prisma.atoll.findMany();
  const normAtoll = (s: string) =>
    s.toLowerCase().replace(/['’]/g, "").replace(/\s+/g, " ").trim().replace(/ atoll$/, "");
  const codeByAlias = new Map<string, string>();
  for (const a of atolls) {
    codeByAlias.set(normAtoll(a.code), a.code);
    codeByAlias.set(normAtoll(a.name), a.code);
  }
  // Capital-region variants used by the sources but absent from the Atoll registry
  codeByAlias.set("mle", "Male");
  codeByAlias.set("maale", "Male");
  codeByAlias.set("maale city", "Male");
  codeByAlias.set("male city", "Male");

  let atollResolved = 0;
  let atollLeft = 0;
  const atollConflicts = await prisma.dataConflict.findMany({
    where: { status: "unresolved", conflictType: "value-mismatch", fieldName: "atoll" },
  });
  for (const c of atollConflicts) {
    const values: SourceValue[] = JSON.parse(c.sourceValues);
    const keys = values.map((v) => codeByAlias.get(normAtoll(v.normalizedValue ?? v.rawValue ?? "")) ?? null);
    const allSame = keys.every((k) => k != null && k === keys[0]);
    if (!allSame || !values.some((v) => v.source === "onemap")) {
      atollLeft++;
      continue;
    }
    await prisma.dataConflict.update({
      where: { id: c.id },
      data: {
        status: "resolved",
        reviewedBy: "policy:onemap-primary",
        reviewedAt: now,
        reviewerNote:
          "All sources refer to the same atoll using different naming conventions (OneMap atoll code vs spelled-out name). " +
          "OneMap's code confirmed as canonical; the registry displays the long name with the code in brackets.",
      },
    });
    if (c.islandId) touchedIslands.add(c.islandId);
    atollResolved++;
  }

  // ---------------- Policy 4: Status vocabulary ----------------
  const STATUS_FINE = new Set(["resort", "industrial", "institutional"]);
  let statusResolved = 0;
  const statusConflicts = await prisma.dataConflict.findMany({
    where: { status: "unresolved", conflictType: "value-mismatch", fieldName: "status" },
  });
  for (const c of statusConflicts) {
    const values: SourceValue[] = JSON.parse(c.sourceValues);
    const om = sourceValue(values, "onemap");
    if (om == null || !STATUS_FINE.has(om) || !sameValue(c.canonicalValue, om)) continue;
    const others = values.filter((v) => v.source !== "onemap").map((v) => v.normalizedValue ?? v.rawValue ?? "");
    if (!others.every((v) => v === "uninhabited" || sameValue(v, om))) continue;
    await prisma.dataConflict.update({
      where: { id: c.id },
      data: {
        status: "resolved",
        reviewedBy: "policy:onemap-primary",
        reviewedAt: now,
        reviewerNote:
          `OneMap's finer status breakdown (${om}) confirmed as canonical. StatsMap labels islands without ` +
          "resident administrative population 'uninhabited' by census definition — a vocabulary difference, not a disagreement.",
      },
    });
    if (c.islandId) touchedIslands.add(c.islandId);
    statusResolved++;
  }

  // ---------------- Policy 5: Island area ----------------
  let areaResolved = 0;
  const areaConflicts = await prisma.dataConflict.findMany({
    where: { status: "unresolved", conflictType: "value-mismatch", fieldName: "area_ha" },
  });
  for (const c of areaConflicts) {
    const om = sourceValue(JSON.parse(c.sourceValues), "onemap");
    if (!sameValue(c.canonicalValue, om)) continue;
    await prisma.dataConflict.update({
      where: { id: c.id },
      data: {
        status: "resolved",
        reviewedBy: "policy:onemap-primary",
        reviewedAt: now,
        reviewerNote:
          "OneMap area confirmed as canonical: surveyed polygon areas from the current national geospatial portal. " +
          "AoM areas are historical and predate extensive land reclamation; the AoM value remains published.",
      },
    });
    if (c.islandId) touchedIslands.add(c.islandId);
    areaResolved++;
  }

  // ---------------- Policy 6: Use category ----------------
  let useResolved = 0;
  const useConflicts = await prisma.dataConflict.findMany({
    where: { status: "unresolved", conflictType: "value-mismatch", fieldName: "use_category" },
  });
  for (const c of useConflicts) {
    const om = sourceValue(JSON.parse(c.sourceValues), "onemap");
    if (om == null || !sameValue(c.canonicalValue, om)) continue;
    await prisma.dataConflict.update({
      where: { id: c.id },
      data: {
        status: "resolved",
        reviewedBy: "policy:onemap-primary",
        reviewedAt: now,
        reviewerNote:
          `OneMap use category ('${om}') confirmed as canonical per steward direction: vocabularies differ across sources ` +
          "('Resorts' vs 'Resort', 'Mariculture' vs 'Aquaculture') and AoM lease data is historical. AoM value remains published.",
      },
    });
    if (c.islandId) touchedIslands.add(c.islandId);
    useResolved++;
  }

  // ---------------- Policy 7: inhabited vs other-inhabited (Census-2022-backed) ----------------
  // StatsMap's "OtherInhabited" is its layer name for inhabited islands outside
  // the capital region — vocabulary, not disagreement. Steward direction:
  // Census 2022 is the primary evidence of habitation. Resolve as inhabited
  // when the island has a Census 2022 resident population.
  let inhabResolved = 0;
  const inhabConflicts = await prisma.dataConflict.findMany({
    where: { status: "unresolved", conflictType: "value-mismatch", fieldName: "status" },
  });
  for (const c of inhabConflicts) {
    const values: SourceValue[] = JSON.parse(c.sourceValues);
    const om = sourceValue(values, "onemap");
    const sm = sourceValue(values, "statsmap");
    if (om !== "inhabited" || sm !== "other-inhabited") continue;
    if (!values.filter((v) => !["onemap", "statsmap"].includes(v.source)).every((v) => (v.normalizedValue ?? v.rawValue) === "inhabited")) continue;
    if (!c.islandId) continue;
    const census = await prisma.islandPopulation.findFirst({
      where: { islandId: c.islandId, sourceSlug: "census-2022", total: { gt: 0 } },
    });
    if (!census) continue;
    await prisma.dataConflict.update({
      where: { id: c.id },
      data: {
        status: "resolved",
        reviewedBy: "policy:census-2022-primary",
        reviewedAt: now,
        reviewerNote:
          `Census 2022 (primary source for habitation) records ${census.total} residents — island is inhabited. ` +
          "StatsMap's 'other-inhabited' is its layer name for inhabited islands outside the capital region, not a disagreement.",
      },
    });
    touchedIslands.add(c.islandId);
    inhabResolved++;
  }

  // ---------------- Steward decisions (2026-06-12) ----------------
  // Atoll disagreements reviewed individually by the registry steward: in all
  // four, the registry's surveyed coordinates fall inside OneMap's atoll, and
  // the dissenting source value is a data-entry/wrong-match error — most
  // likely a same-named island elsewhere in the country.
  const STEWARD_ATOLL_DECISIONS: { slug: string; note: string }[] = [
    {
      slug: "lh-vihafarufinolhu",
      note: "Steward review 2026-06-12: OneMap (Lh) correct — coordinates 5.456N 73.582E fall in Lhaviyani; Atolls of Maldives entry (N) is a data-entry/wrong-match error, likely the same-named island in Noonu.",
    },
    {
      slug: "lh-dhihdhoo",
      note: "Steward review 2026-06-12: OneMap (Lh) correct — coordinates 5.376N 73.382E fall in Lhaviyani; StatsMap (ADh) and Atolls of Maldives (HA) matched same-named islands elsewhere (Dhihdhoo is also the Haa Alifu capital).",
    },
    {
      slug: "r-maamingili",
      note: "Steward review 2026-06-12: OneMap (R) correct — coordinates 5.651N 72.885E fall in Raa; StatsMap (ADh) matched the well-known Maamigili airport island in Alifu Dhaalu instead.",
    },
    {
      slug: "k-huraa",
      note: "Steward review 2026-06-12: OneMap (K) correct — coordinates 4.334N 73.602E fall in Kaafu; Atolls of Maldives entry (HDh) is a data-entry/wrong-match error.",
    },
  ];
  let stewardResolved = 0;
  for (const d of STEWARD_ATOLL_DECISIONS) {
    const island = await prisma.island.findUnique({ where: { slug: d.slug } });
    if (!island) continue;
    const res = await prisma.dataConflict.updateMany({
      where: { islandId: island.id, fieldName: "atoll", conflictType: "value-mismatch", status: "unresolved" },
      data: { status: "resolved", reviewedBy: "admin", reviewedAt: now, reviewerNote: d.note },
    });
    if (res.count) touchedIslands.add(island.id);
    stewardResolved += res.count;
  }

  // FCODE: StatsMap's LD1999 is its own internal record key for N Holhudhoo —
  // matched by atoll+name at 97% confidence with census-consistent population.
  // OneMap's LD0455 is the registry code. Steward decision 2026-06-12.
  const holhudhoo = await prisma.island.findUnique({ where: { slug: "n-holhudhoo" } });
  if (holhudhoo) {
    const res = await prisma.dataConflict.updateMany({
      where: { islandId: holhudhoo.id, fieldName: "fcode", conflictType: "value-mismatch", status: "unresolved" },
      data: {
        status: "resolved",
        reviewedBy: "admin",
        reviewedAt: now,
        reviewerNote:
          "Steward review 2026-06-12: same island — LD1999 is StatsMap's internal record key for N Holhudhoo " +
          "(atoll+name match, population consistent with Census 2022). OneMap's LD0455 is the registry code.",
      },
    });
    if (res.count) touchedIslands.add(holhudhoo.id);
    stewardResolved += res.count;
  }

  // ---------------- Context notes for open status conflicts ----------------
  // Steward direction 2026-06-12: keep the remaining status disagreements
  // unresolved, but attach current ground truth from the Tourism Ministry
  // registered-facilities ingest (scrape:tourism) so each one can be judged
  // with context. Notes are refreshed on every run; manual notes are kept.
  const tourism = await prisma.source.findUnique({ where: { slug: "tourism-ministry" } });
  let contextNoted = 0;
  if (tourism) {
    const openStatus = await prisma.dataConflict.findMany({
      where: { status: "unresolved", conflictType: "value-mismatch", fieldName: "status" },
    });
    for (const c of openStatus) {
      if (!c.islandId) continue;
      if (c.reviewerNote && !c.reviewerNote.startsWith("[context")) continue; // manual note — leave alone
      const resort = await prisma.fieldValue.findFirst({
        where: { entityId: c.islandId, sourceId: tourism.id, fieldName: "resort_name" },
      });
      const state = resort
        ? await prisma.fieldValue.findFirst({
            where: { entityId: c.islandId, sourceId: tourism.id, fieldName: "resort_operating_state" },
          })
        : null;
      const values: SourceValue[] = JSON.parse(c.sourceValues);
      const anyResortClaim = values.some((v) => (v.normalizedValue ?? v.rawValue) === "resort");
      let note: string | null = null;
      if (resort) {
        note = `[context 2026-06-12] Tourism Ministry registered facilities: "${resort.normalizedValue}" — ${state?.normalizedValue ?? "state unknown"}.`;
      } else if (anyResortClaim) {
        note = "[context 2026-06-12] No registered resort on this island in the Tourism Ministry facilities export.";
      }
      if (note && c.reviewerNote !== note) {
        await prisma.dataConflict.update({ where: { id: c.id }, data: { reviewerNote: note } });
        contextNoted++;
      }
    }

    // Steward-verified history for HDh Kun'burudhoo (kept unresolved intentionally):
    const kunburudhoo = await prisma.island.findUnique({ where: { slug: "hdh-kunburudhoo" } });
    if (kunburudhoo) {
      const res = await prisma.dataConflict.updateMany({
        where: { islandId: kunburudhoo.id, fieldName: "status", status: "unresolved" },
        data: {
          reviewerNote:
            "[context 2026-06-12, steward-verified] Population relocated to HDh Nolhivaranfaru in 2011 under the " +
            "consolidation programme (with Maavaidhoo and Faridhoo); Census 2014 already recorded the island as no longer " +
            "inhabited and Census 2022 has no record. The island now hosts the regional waste transfer station serving " +
            "HA/HDh/Sh atolls (built ~2022). AoM 'inhabited' is the pre-relocation archive value; OneMap 'uninhabited' is " +
            "correct for habitation, though 'industrial' may now fit better.",
        },
      });
      contextNoted += res.count;
    }
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
        `Census 2022: ${censusVerified} values verified, ${populationResolved} population conflicts resolved. ` +
        `Atoll naming: ${atollResolved} resolved as same-atoll naming-convention differences, ${atollLeft} kept (genuine disagreement). ` +
        `Status vocabulary: ${statusResolved} resolved. Area: ${areaResolved} resolved. Use category: ${useResolved} resolved. ` +
        `Inhabited (census-backed): ${inhabResolved} resolved. ` +
        `Steward decisions: ${stewardResolved} atoll disagreements resolved in OneMap's favour (coordinate-verified).`,
    },
  });

  console.log(
    `Done. OneMap — name: ${nameResolved}, coords resolved: ${coordResolved}, escalated: ${coordEscalated}. ` +
      `Census 2022 — population: ${populationResolved}. ` +
      `Atoll naming — resolved: ${atollResolved}, kept: ${atollLeft}. ` +
      `Status: ${statusResolved}. Area: ${areaResolved}. Use category: ${useResolved}. Inhabited: ${inhabResolved}. Context notes: ${contextNoted}. ` +
      `Steward decisions: ${stewardResolved}. Islands updated: ${touchedIslands.size}.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
