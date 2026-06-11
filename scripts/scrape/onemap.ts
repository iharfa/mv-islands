/**
 * OneMap Maldives scraper.
 * Pulls island polygons + registry attributes from the public ArcGIS feature
 * service behind onemap.mv, plus the published island list CSV.
 * Raw responses are archived under data/raw/onemap before any transformation.
 */
import { politeFetch, archiveRaw } from "../lib/http";
import { startRun, prisma } from "../lib/runlog";

const ISLAND_LAYER =
  "https://services7.arcgis.com/yvCbn3q8PPtPLZIM/arcgis/rest/services/island_20240509/FeatureServer/0";
const EXTRA_LAYERS = [
  "https://services7.arcgis.com/yvCbn3q8PPtPLZIM/arcgis/rest/services/reef/FeatureServer/0",
  "https://services7.arcgis.com/yvCbn3q8PPtPLZIM/arcgis/rest/services/Onemap_Latest/FeatureServer/0",
  "https://services7.arcgis.com/yvCbn3q8PPtPLZIM/arcgis/rest/services/Onemap_Latest/FeatureServer/1",
  "https://services7.arcgis.com/yvCbn3q8PPtPLZIM/arcgis/rest/services/Onemap_Latest/FeatureServer/2",
];
const ISLAND_LIST_CSV = "https://readme.onemap.mv/csv/IslandList_20211101.csv";
const PAGE_SIZE = 500;

async function main() {
  const run = await startRun("onemap");
  try {
    // Layer metadata
    const meta = await politeFetch(`${ISLAND_LAYER}?f=json`);
    run.page();
    archiveRaw("onemap", "island_layer_metadata.json", meta.body);

    // Paginated GeoJSON pull of all island features
    const features: unknown[] = [];
    let offset = 0;
    for (;;) {
      const url = `${ISLAND_LAYER}/query?where=1%3D1&outFields=*&outSR=4326&f=geojson&resultOffset=${offset}&resultRecordCount=${PAGE_SIZE}`;
      const res = await politeFetch(url);
      run.page();
      if (res.status !== 200) {
        run.fail(url, `HTTP ${res.status}`);
        break;
      }
      archiveRaw("onemap", `island_features_offset_${offset}.geojson`, res.body);
      const fc = JSON.parse(res.body);
      const batch = fc.features ?? [];
      features.push(...batch);
      run.log(`Fetched ${batch.length} island features (offset ${offset})`);
      if (batch.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    run.record(features.length);

    const merged = { type: "FeatureCollection", features };
    archiveRaw("onemap", "islands_all.geojson", JSON.stringify(merged));

    // Island list CSV (2021 vintage registry list)
    try {
      const csv = await politeFetch(ISLAND_LIST_CSV);
      run.page();
      archiveRaw("onemap", "IslandList_20211101.csv", csv.body);
      run.log(`Island list CSV: ${csv.body.split("\n").length - 1} rows`);
    } catch (e) {
      run.fail(ISLAND_LIST_CSV, String(e));
    }

    // Metadata for supporting layers (geometry pulled lazily later if needed)
    for (const layer of EXTRA_LAYERS) {
      try {
        const res = await politeFetch(`${layer}?f=json`);
        run.page();
        archiveRaw("onemap", `layer_meta_${layer.split("/services/")[1].replace(/\//g, "_")}.json`, res.body);
      } catch (e) {
        run.fail(layer, String(e));
      }
    }

    // Register the source document
    await prisma.sourceDocument.create({
      data: {
        sourceId: run.source.id,
        url: ISLAND_LAYER,
        title: "OneMap island polygons (island_20240509)",
        docType: "arcgis-layer",
        rawPath: "data/raw/onemap/islands_all.geojson",
        fetchedAt: new Date(),
        httpStatus: 200,
      },
    });
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
