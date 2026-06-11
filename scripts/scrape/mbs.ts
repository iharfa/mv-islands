/**
 * Maldives Bureau of Statistics scraper.
 * Downloads Census 2022 result tables (XLSX) and island/atoll indicator sheets,
 * archives the raw files, and parses island-level population (Table P5: resident
 * population by island and sex; Table P3: 2014/2022 island comparison).
 */
import * as XLSX from "xlsx";
import { politeFetch, politeFetchBinary, archiveRaw } from "../lib/http";
import { startRun, prisma } from "../lib/runlog";

const CENSUS_BASE = "https://census.gov.mv/2022/wp-content/uploads/2023/03";
const CENSUS_TABLES = ["Table-P1", "Table-P2", "Table-P3", "Table-P4", "Table-P5", "Table-P6", "Table-P7", "Table-P8", "Table-H1", "Table-H3", "Table-H4", "Table-H5", "Table-H6"];
const INDICATOR_SHEETS = [
  "https://statisticsmaldives.gov.mv/mbs/wp-content/uploads/2025/08/parliment_indicator-pop.xlsx",
  "https://statisticsmaldives.gov.mv/mbs/wp-content/uploads/2025/08/parliment_indicator-edu.xlsx",
  "https://statisticsmaldives.gov.mv/mbs/wp-content/uploads/2025/08/parliment_indicator-emp.xlsx",
];
const LISTING_PAGE = "https://statisticsmaldives.gov.mv/census-2022/";

const NON_ISLAND_ROWS = new Set([
  "republic", "maale", "male'", "atolls", "admin islands", "industrial islands",
  "resorts", "other islands", "harbours (maale, hulhumaale & vilimaale)",
]);

type Row = (string | number | null | undefined)[];

export interface CensusIslandRecord {
  atollAbr: string;
  island: string;
  total: number;
  female: number | null;
  male: number | null;
  maldivian: number | null;
  foreign: number | null;
  total2014?: number | null;
  table: string;
}

/** Parse Table P5 (resident population by island and sex, 2022). */
export function parseP5(rows: Row[]): CensusIslandRecord[] {
  const out: CensusIslandRecord[] = [];
  let currentAtoll = "";
  for (const r of rows) {
    const abr = String(r[1] ?? "").trim();
    const island = String(r[2] ?? "").trim();
    const total = r[3];
    if (abr) currentAtoll = abr;
    if (!island || typeof total !== "number") continue;
    if (NON_ISLAND_ROWS.has(island.toLowerCase())) continue;
    out.push({
      atollAbr: abr || (island.match(/maale|hulhule/i) ? "Male" : currentAtoll),
      island,
      total,
      female: typeof r[4] === "number" ? r[4] : null,
      male: typeof r[5] === "number" ? r[5] : null,
      maldivian: typeof r[6] === "number" ? r[6] : null,
      foreign: typeof r[9] === "number" ? r[9] : null,
      table: "P5",
    });
  }
  return out;
}

/** Parse Table P3 (resident population by island, 2014 & 2022). */
export function parseP3(rows: Row[]): CensusIslandRecord[] {
  const out: CensusIslandRecord[] = [];
  let currentAtoll = "";
  for (const r of rows) {
    const abr = String(r[0] ?? "").trim();
    const island = String(r[1] ?? "").trim();
    const total = r[2];
    if (abr) currentAtoll = abr;
    if (!island || typeof total !== "number") continue;
    if (NON_ISLAND_ROWS.has(island.toLowerCase())) continue;
    out.push({
      atollAbr: abr || (island.match(/maale|hulhule/i) ? "Male" : currentAtoll),
      island,
      total,
      female: null,
      male: null,
      maldivian: typeof r[3] === "number" ? r[3] : null,
      foreign: typeof r[4] === "number" ? r[4] : null,
      total2014: typeof r[5] === "number" ? r[5] : null,
      table: "P3",
    });
  }
  return out;
}

async function main() {
  const run = await startRun("census-2022");
  const indicatorRun = await startRun("mbs-indicators");
  try {
    // Archive the listing page that links the tables
    const listing = await politeFetch(LISTING_PAGE);
    run.page();
    archiveRaw("mbs", "census-2022-listing.html", listing.body);

    const parsed: Record<string, CensusIslandRecord[]> = {};
    for (const table of CENSUS_TABLES) {
      const url = `${CENSUS_BASE}/${table}.xlsx`;
      try {
        const res = await politeFetchBinary(url);
        run.page();
        if (res.status !== 200) { run.fail(url, `HTTP ${res.status}`); continue; }
        archiveRaw("mbs/census-tables", `${table}.xlsx`, res.buffer);
        const wb = XLSX.read(res.buffer);
        const rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
        if (table === "Table-P5") parsed.P5 = parseP5(rows);
        if (table === "Table-P3") parsed.P3 = parseP3(rows);
        run.log(`${table}: downloaded (${res.buffer.length} bytes)`);
        await prisma.sourceDocument.create({
          data: {
            sourceId: run.source.id,
            url,
            title: `Census 2022 ${table}`,
            docType: "xlsx",
            rawPath: `data/raw/mbs/census-tables/${table}.xlsx`,
            fetchedAt: new Date(res.fetchedAt),
            httpStatus: res.status,
          },
        });
      } catch (e) {
        run.fail(url, String(e));
      }
    }

    run.record(parsed.P5?.length ?? 0);
    run.record(parsed.P3?.length ?? 0);
    run.log(`Parsed P5 islands: ${parsed.P5?.length ?? 0}, P3 islands: ${parsed.P3?.length ?? 0}`);
    archiveRaw("mbs", "census_population_by_island.json", JSON.stringify(parsed, null, 2));

    // Indicator sheets
    for (const url of INDICATOR_SHEETS) {
      try {
        const res = await politeFetchBinary(url);
        indicatorRun.page();
        if (res.status !== 200) { indicatorRun.fail(url, `HTTP ${res.status}`); continue; }
        const name = url.split("/").pop()!;
        archiveRaw("mbs/indicator-sheets", name, res.buffer);
        indicatorRun.record();
        indicatorRun.log(`Downloaded ${name} (${res.buffer.length} bytes)`);
        await prisma.sourceDocument.create({
          data: {
            sourceId: indicatorRun.source.id,
            url,
            title: `Indicator sheet ${name}`,
            docType: "xlsx",
            rawPath: `data/raw/mbs/indicator-sheets/${name}`,
            fetchedAt: new Date(res.fetchedAt),
            httpStatus: res.status,
          },
        });
      } catch (e) {
        indicatorRun.fail(url, String(e));
      }
    }

    await run.finish();
    await indicatorRun.finish();
  } catch (e) {
    run.log(`FATAL: ${e}`);
    await run.finish("failed");
    await indicatorRun.finish("failed");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main();
