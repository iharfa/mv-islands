/** snapshot:export — zips a snapshot directory into a release artifact. */
import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";

const DATE = process.argv[2] ?? process.env.SNAPSHOT_DATE ?? new Date().toISOString().slice(0, 10);
const SNAP = path.join(process.cwd(), "data", "snapshots", DATE);
const OUT = path.join(process.cwd(), "data", "snapshots", `maldives-island-registry-snapshot-${DATE}.zip`);

if (!fs.existsSync(SNAP)) {
  console.error(`Snapshot directory not found: ${SNAP}. Run npm run snapshot:create first.`);
  process.exit(1);
}
const zip = new AdmZip();
zip.addLocalFolder(SNAP, DATE);
zip.writeZip(OUT);
console.log(`Wrote ${OUT} (${(fs.statSync(OUT).size / 1024 / 1024).toFixed(1)} MB)`);
