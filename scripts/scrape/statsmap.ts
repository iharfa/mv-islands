/**
 * MBS StatsMap scraper.
 * The StatsMap app (statisticsmaldives.gov.mv/gismaps/statsmap) is a qgis2web
 * export whose layers are static GeoJSON wrapped in JS variable assignments.
 * We download every layer file, archive the raw JS, and extract clean GeoJSON.
 */
import { politeFetch, archiveRaw } from "../lib/http";
import { startRun, prisma } from "../lib/runlog";

const BASE = "https://statisticsmaldives.gov.mv/gismaps/statsmap";

export const STATSMAP_LAYERS = [
  "Reef_0", "causeway_1", "AdministrativeIsland_2", "veg_3", "StreetBlock_4",
  "ParcelCategory_5", "wetland_6", "runway_7", "plotLine_8", "Road_9",
  "Airport_10", "Uninhabited_11", "OtherInhabited_12", "AtollCapital_13",
  "Hotels_14", "GuestHouse_15", "Resort_16", "Mosque_17", "GovernmentOffice_18",
  "School_19", "AtollBoundaryLine_20", "AdministrativeAtoll_21",
  "WardMaaleandFoahmulah_22", "IslandName_23", "ProtectedAreaEPA_25",
];

// Heavy parcel-level layers we skip by default to stay polite (huge, not needed):
// StreetBlock_4, ParcelCategory_5, plotLine_8, Address_24
const SKIP_HEAVY = new Set(["StreetBlock_4", "ParcelCategory_5", "plotLine_8", "Address_24"]);

export function extractGeoJson(jsBody: string): unknown {
  const idx = jsBody.indexOf("=");
  if (idx === -1) throw new Error("No assignment found in layer JS");
  let json = jsBody.slice(idx + 1).trim();
  if (json.endsWith(";")) json = json.slice(0, -1);
  return JSON.parse(json);
}

async function main() {
  const run = await startRun("statsmap");
  try {
    // Archive the app HTML itself
    const home = await politeFetch(`${BASE}/`);
    run.page();
    archiveRaw("statsmap", "statsmap_app.html", home.body);

    for (const layer of STATSMAP_LAYERS) {
      if (SKIP_HEAVY.has(layer)) {
        run.log(`Skipping heavy parcel layer ${layer} (not needed; politeness)`);
        continue;
      }
      const url = `${BASE}/layers/${layer}.js`;
      try {
        const res = await politeFetch(url);
        run.page();
        if (res.status !== 200) {
          run.fail(url, `HTTP ${res.status}`);
          continue;
        }
        archiveRaw("statsmap", `${layer}.js`, res.body);
        const geojson = extractGeoJson(res.body) as { features?: unknown[] };
        archiveRaw("statsmap", `${layer}.geojson`, JSON.stringify(geojson));
        const count = geojson.features?.length ?? 0;
        run.record(count);
        run.log(`${layer}: ${count} features`);
        await prisma.sourceDocument.create({
          data: {
            sourceId: run.source.id,
            url,
            title: `StatsMap layer ${layer}`,
            docType: "api-json",
            rawPath: `data/raw/statsmap/${layer}.js`,
            contentHash: res.contentHash,
            fetchedAt: new Date(res.fetchedAt),
            httpStatus: res.status,
          },
        });
      } catch (e) {
        run.fail(url, String(e));
      }
    }
    await run.finish();
  } catch (e) {
    run.log(`FATAL: ${e}`);
    await run.finish("failed");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main();
