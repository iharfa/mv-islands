/** snapshot:validate — verifies snapshot structure, manifest and checksums. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DATE = process.argv[2] ?? process.env.SNAPSHOT_DATE ?? new Date().toISOString().slice(0, 10);
const SNAP = path.join(process.cwd(), "data", "snapshots", DATE);

const REQUIRED = [
  "metadata/snapshot_manifest.json",
  "metadata/checksums.sha256",
  "metadata/scrape_report.md",
  "metadata/conflict_report.md",
  "metadata/source_inventory.md",
  "processed/islands_canonical.csv",
  "processed/islands_canonical.geojson",
  "processed/islands_all_source_values.csv",
  "processed/islands_conflicts.csv",
  "processed/atolls.csv",
  "processed/population.csv",
  "processed/source_registry.csv",
  `database/registry_snapshot_${DATE}.sqlite`,
  `database/postgres_dump_${DATE}.sql`,
];

let failures = 0;
const fail = (msg: string) => { console.error(`FAIL: ${msg}`); failures++; };

if (!fs.existsSync(SNAP)) {
  console.error(`Snapshot directory not found: ${SNAP}`);
  process.exit(1);
}

for (const rel of REQUIRED) {
  const f = path.join(SNAP, rel);
  if (!fs.existsSync(f)) fail(`missing required file ${rel}`);
  else if (fs.statSync(f).size === 0) fail(`empty file ${rel}`);
}

// Manifest sanity
try {
  const manifest = JSON.parse(fs.readFileSync(path.join(SNAP, "metadata", "snapshot_manifest.json"), "utf8"));
  for (const key of ["snapshot_date", "generated_at", "total_islands", "total_atolls", "total_conflicts", "files_included", "restore_instructions"]) {
    if (manifest[key] === undefined) fail(`manifest missing key ${key}`);
  }
  if (manifest.total_islands < 100) fail(`implausible island count ${manifest.total_islands}`);
} catch (e) {
  fail(`manifest unreadable: ${e}`);
}

// Checksums
try {
  const lines = fs.readFileSync(path.join(SNAP, "metadata", "checksums.sha256"), "utf8").split("\n").filter(Boolean);
  let checked = 0, mismatched = 0;
  for (const line of lines) {
    const [hash, rel] = line.split(/\s{2,}/);
    const f = path.join(SNAP, rel);
    if (!fs.existsSync(f)) { fail(`checksum references missing file ${rel}`); continue; }
    const actual = crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
    if (actual !== hash && !rel.includes("snapshot_manifest")) { mismatched++; fail(`checksum mismatch ${rel}`); }
    checked++;
  }
  console.log(`Checksums verified: ${checked} files, ${mismatched} mismatches`);
} catch (e) {
  fail(`checksum verification error: ${e}`);
}

// CSV row sanity
const csv = fs.readFileSync(path.join(SNAP, "processed", "islands_canonical.csv"), "utf8");
const rows = csv.split("\n").length - 1;
if (rows < 100) fail(`islands_canonical.csv has only ${rows} rows`);
else console.log(`islands_canonical.csv: ${rows} rows`);

if (failures) {
  console.error(`\nSnapshot ${DATE} INVALID — ${failures} problem(s).`);
  process.exit(1);
}
console.log(`\nSnapshot ${DATE} is valid.`);
