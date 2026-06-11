/** Exports all canonical CSV datasets to data/exports/. */
import fs from "node:fs";
import path from "node:path";
import {
  toCsv, islandsCanonicalRows, allSourceValuesRows, conflictsRows, atollsRows,
  populationRows, sourceRegistryRows,
} from "../../src/lib/exports";

export async function exportCsvFiles(outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });
  const files: Record<string, Record<string, unknown>[]> = {
    "islands_canonical.csv": await islandsCanonicalRows(),
    "islands_all_source_values.csv": await allSourceValuesRows(),
    "islands_conflicts.csv": await conflictsRows(),
    "atolls.csv": await atollsRows(),
    "population.csv": await populationRows(),
    "source_registry.csv": await sourceRegistryRows(),
  };
  const written: string[] = [];
  for (const [name, rows] of Object.entries(files)) {
    const p = path.join(outDir, name);
    fs.writeFileSync(p, toCsv(rows));
    written.push(p);
    console.log(`Wrote ${name} (${rows.length} rows)`);
  }
  return written;
}

if (require.main === module) {
  exportCsvFiles(path.join(process.cwd(), "data", "exports")).then(() => process.exit(0));
}
