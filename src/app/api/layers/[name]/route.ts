import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

// Whitelisted StatsMap-derived layers served from the raw archive.
const LAYERS: Record<string, string> = {
  "protected-areas": "ProtectedAreaEPA_25.geojson",
  "reefs": "Reef_0.geojson",
  "wetlands": "wetland_6.geojson",
  "vegetation": "veg_3.geojson",
  "resorts": "Resort_16.geojson",
  "airports": "Airport_10.geojson",
  "atoll-boundaries": "AtollBoundaryLine_20.geojson",
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const file = LAYERS[name];
  if (!file) {
    return NextResponse.json({ error: "Unknown layer", available: Object.keys(LAYERS) }, { status: 404 });
  }
  const full = path.join(process.cwd(), "data", "raw", "statsmap", file);
  if (!fs.existsSync(full)) {
    return NextResponse.json(
      { error: "Layer data not yet available", detail: `Run npm run scrape:statsmap to ingest ${file}` },
      { status: 404 },
    );
  }
  return new NextResponse(fs.readFileSync(full, "utf8"), {
    headers: { "Content-Type": "application/geo+json", "Cache-Control": "public, max-age=3600" },
  });
}
