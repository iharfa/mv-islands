/** Exports the canonical islands GeoJSON to data/exports/. */
import fs from "node:fs";
import path from "node:path";
import { islandsGeoJson } from "../../src/lib/exports";

export async function exportGeoJson(outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });
  const gj = await islandsGeoJson();
  const p = path.join(outDir, "islands_canonical.geojson");
  fs.writeFileSync(p, JSON.stringify(gj));
  console.log(`Wrote islands_canonical.geojson (${gj.features.length} features)`);
  return [p];
}

if (require.main === module) {
  exportGeoJson(path.join(process.cwd(), "data", "exports")).then(() => process.exit(0));
}
