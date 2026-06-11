import { NextRequest, NextResponse } from "next/server";
import {
  toCsv, islandsCanonicalRows, islandsGeoJson, conflictsRows, sourceRegistryRows,
  allSourceValuesRows, atollsRows, populationRows,
} from "@/lib/exports";

export const dynamic = "force-dynamic";

const FILES: Record<string, () => Promise<{ body: string; type: string }>> = {
  "islands.geojson": async () => ({ body: JSON.stringify(await islandsGeoJson()), type: "application/geo+json" }),
  "islands.csv": async () => ({ body: toCsv(await islandsCanonicalRows()), type: "text/csv" }),
  "islands-all-source-values.csv": async () => ({ body: toCsv(await allSourceValuesRows()), type: "text/csv" }),
  "conflicts.csv": async () => ({ body: toCsv(await conflictsRows()), type: "text/csv" }),
  "source-registry.csv": async () => ({ body: toCsv(await sourceRegistryRows()), type: "text/csv" }),
  "atolls.csv": async () => ({ body: toCsv(await atollsRows()), type: "text/csv" }),
  "population.csv": async () => ({ body: toCsv(await populationRows()), type: "text/csv" }),
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const generator = FILES[file];
  if (!generator) return NextResponse.json({ error: "Unknown download", available: Object.keys(FILES) }, { status: 404 });
  const { body, type } = await generator();
  return new NextResponse(body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
