/**
 * snapshot:release — creates/updates a GitHub release for a snapshot and
 * attaches the zipped artifact. Requires the `gh` CLI to be authenticated
 * (in CI, GITHUB_TOKEN is injected automatically).
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const DATE = process.argv[2] ?? process.env.SNAPSHOT_DATE ?? new Date().toISOString().slice(0, 10);
const zip = path.join(process.cwd(), "data", "snapshots", `maldives-island-registry-snapshot-${DATE}.zip`);
const tag = `snapshot-${DATE}`;

if (!fs.existsSync(zip)) {
  console.error(`Artifact not found: ${zip}. Run npm run snapshot:export first.`);
  process.exit(1);
}
const notes = `Maldives Island Registry data snapshot ${DATE}.\n\nIncludes raw source archives, canonical CSV/GeoJSON exports, conflict datasets, SQLite database and PostgreSQL dump with SHA-256 checksums. See metadata/snapshot_manifest.json inside the archive.`;
try {
  execSync(`gh release view ${tag}`, { stdio: "ignore" });
  execSync(`gh release upload ${tag} "${zip}" --clobber`, { stdio: "inherit" });
} catch {
  execSync(`gh release create ${tag} "${zip}" --title "Data snapshot ${DATE}" --notes "${notes.replace(/"/g, '\\"')}"`, { stdio: "inherit" });
}
console.log(`Release ${tag} updated.`);
