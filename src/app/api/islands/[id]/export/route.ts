import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/exports";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const format = req.nextUrl.searchParams.get("format") ?? "json";
  const island = await prisma.island.findFirst({
    where: { OR: [{ slug: id }, { id }] },
    include: { atoll: true, geometries: true, population: true, conflicts: true, names: true },
  });
  if (!island) return NextResponse.json({ error: "Island not found" }, { status: 404 });

  const headers = (name: string, type: string) => ({
    "Content-Type": type,
    "Content-Disposition": `attachment; filename="${island.slug}-${name}"`,
  });

  if (format === "csv") {
    const row = {
      slug: island.slug, name: island.name, dhivehi_name: island.dhivehiName ?? "",
      atoll: island.atoll?.code ?? "", status: island.status ?? "", island_type: island.islandType ?? "",
      use_category: island.useCategory ?? "", lat: island.lat ?? "", lng: island.lng ?? "",
      area_sq_km: island.areaSqKm ?? "", completeness: island.overallScore,
      unresolved_conflicts: island.unresolvedConflicts, last_updated: island.lastUpdatedAt.toISOString(),
    };
    return new NextResponse(toCsv([row]), { headers: headers("canonical.csv", "text/csv") });
  }

  if (format === "geojson") {
    const geom = island.geometries.find((g) => g.sourceSlug === "onemap") ?? island.geometries[0];
    const feature = {
      type: "Feature",
      properties: { slug: island.slug, name: island.name, atoll: island.atoll?.code, status: island.status, areaSqKm: island.areaSqKm },
      geometry: geom ? JSON.parse(geom.geometry) : island.lat != null ? { type: "Point", coordinates: [island.lng, island.lat] } : null,
    };
    return new NextResponse(JSON.stringify(feature, null, 2), { headers: headers("island.geojson", "application/geo+json") });
  }

  if (format === "conflicts") {
    return new NextResponse(
      JSON.stringify({ island: island.slug, generated: new Date().toISOString(), conflicts: island.conflicts.map((c) => ({ ...c, sourceValues: JSON.parse(c.sourceValues) })) }, null, 2),
      { headers: headers("conflicts.json", "application/json") },
    );
  }

  // full source-value JSON
  const fieldValues = await prisma.fieldValue.findMany({
    where: { entityType: "island", entityId: island.id },
    include: { source: { select: { slug: true, name: true, url: true } } },
    orderBy: { fieldName: "asc" },
  });
  return new NextResponse(
    JSON.stringify({ island, fieldValues, generated: new Date().toISOString() }, null, 2),
    { headers: headers("source-values.json", "application/json") },
  );
}
