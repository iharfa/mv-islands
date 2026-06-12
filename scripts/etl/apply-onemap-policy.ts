/**
 * ETL step 4 — apply the OneMap-primary source policy (2026-06-12).
 *
 * OneMap Maldives is the national geospatial portal maintained by the
 * government agency tasked with surveying, so the registry treats it as a
 * verified source:
 *  - every OneMap field value is marked `verified`;
 *  - name conflicts where OneMap participates and already provides the
 *    canonical value are resolved in OneMap's favour (the disagreement stays
 *    published, per registry principles — resolution only records the review);
 *  - small coordinate disagreements (≤ COORD_RESOLVE_KM between OneMap and
 *    other sources — typical survey/centroid variation) are resolved in
 *    OneMap's favour; larger spreads usually indicate a wrong cross-source
 *    match and are escalated to `needs_external_confirmation` instead.
 *
 * Run after etl:detect-conflicts (which resets all conflict statuses).
 * Only `unresolved` conflicts are touched, so manual review decisions made
 * between ETL runs are never overwritten by this script.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const COORD_RESOLVE_KM = 5;
const KM_PER_DEGREE = 111; // good enough at the equator, which the Maldives straddles
const POLICY_ACTOR = "policy:onemap-primary";
const POLICY_NOTE =
  "OneMap (national geospatial portal, government surveying agency) is the registry's verified primary source";

type SourceValue = { source: string; rawValue?: string | null; normalizedValue?: string | null };

function onemapValue(values: SourceValue[]): string | null {
  const om = values.find((v) => v.source === "onemap");
  return om ? (om.normalizedValue ?? om.rawValue ?? null) : null;
}

async function main() {
  const onemap = await prisma.source.findUnique({ where: { slug: "onemap" } });
  if (!onemap) throw new Error("OneMap source not registered — run db:seed first");

  // 1. OneMap values are verified
  const verified = await prisma.fieldValue.updateMany({
    where: { sourceId: onemap.id, verificationStatus: { not: "verified" } },
    data: { verificationStatus: "verified", dateVerified: new Date() },
  });
  console.log(`Marked ${verified.count} OneMap field values as verified.`);

  const now = new Date();
  let nameResolved = 0;
  let coordResolved = 0;
  let coordEscalated = 0;
  const touchedIslands = new Set<string>();

  // 2. Name conflicts where OneMap provides the canonical value
  const nameConflicts = await prisma.dataConflict.findMany({
    where: { status: "unresolved", conflictType: "value-mismatch", fieldName: { in: ["name", "dhivehi_name"] } },
  });
  for (const c of nameConflicts) {
    const om = onemapValue(JSON.parse(c.sourceValues));
    if (om == null) continue;
    if ((c.canonicalValue ?? "").trim().toLowerCase() !== om.trim().toLowerCase()) continue;
    await prisma.dataConflict.update({
      where: { id: c.id },
      data: {
        status: "resolved",
        reviewedBy: POLICY_ACTOR,
        reviewedAt: now,
        reviewerNote: `${POLICY_NOTE}; OneMap naming confirmed as canonical. Other sources' values remain published.`,
      },
    });
    if (c.islandId) touchedIslands.add(c.islandId);
    nameResolved++;
  }

  // 3. Coordinate conflicts: resolve small spreads, escalate large ones
  const coordConflicts = await prisma.dataConflict.findMany({
    where: { status: "unresolved", conflictType: "value-mismatch", fieldName: { in: ["lat", "lng"] } },
  });
  for (const c of coordConflicts) {
    const values: SourceValue[] = JSON.parse(c.sourceValues);
    const om = onemapValue(values);
    if (om == null || (c.canonicalValue ?? "") !== om) continue;
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
          reviewedBy: POLICY_ACTOR,
          reviewedAt: now,
          reviewerNote: `${POLICY_NOTE}; coordinate spread ${maxDeltaKm.toFixed(2)} km is within normal survey/centroid variation. OneMap coordinates confirmed as canonical.`,
        },
      });
      coordResolved++;
    } else {
      await prisma.dataConflict.update({
        where: { id: c.id },
        data: {
          status: "needs_external_confirmation",
          reviewedBy: POLICY_ACTOR,
          reviewedAt: now,
          reviewerNote: `Coordinate spread ${maxDeltaKm.toFixed(2)} km exceeds ${COORD_RESOLVE_KM} km — likely a wrong cross-source match rather than survey variation. Needs confirmation against source records.`,
        },
      });
      coordEscalated++;
    }
    if (c.islandId) touchedIslands.add(c.islandId);
  }

  // 4. Keep denormalized unresolved counts in sync
  for (const islandId of touchedIslands) {
    const unresolved = await prisma.dataConflict.count({ where: { islandId, status: "unresolved" } });
    await prisma.island.update({ where: { id: islandId }, data: { unresolvedConflicts: unresolved } });
  }

  await prisma.auditLog.create({
    data: {
      actor: POLICY_ACTOR,
      action: "etl:apply-onemap-policy",
      detail: `OneMap values verified (${verified.count} field values). Conflicts: ${nameResolved} name resolved, ${coordResolved} coordinate resolved (≤${COORD_RESOLVE_KM} km), ${coordEscalated} coordinate escalated to needs_external_confirmation (>${COORD_RESOLVE_KM} km).`,
    },
  });

  console.log(
    `Done. Name conflicts resolved: ${nameResolved}; coordinate resolved: ${coordResolved}; coordinate escalated: ${coordEscalated}; islands updated: ${touchedIslands.size}.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
