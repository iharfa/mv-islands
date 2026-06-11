/**
 * snapshot:restore — restores the local registry database from a snapshot.
 * Usage: npm run snapshot:restore -- 2026-06-11
 * Copies the SQLite snapshot over data/registry.db (a .bak of the current DB
 * is kept). For PostgreSQL, use the dump in database/ with psql instead.
 */
import fs from "node:fs";
import path from "node:path";

const DATE = process.argv[2] ?? process.env.SNAPSHOT_DATE;
if (!DATE) {
  const dir = path.join(process.cwd(), "data", "snapshots");
  const available = fs.existsSync(dir) ? fs.readdirSync(dir).filter((d) => /^\d{4}-/.test(d)) : [];
  console.error(`Usage: npm run snapshot:restore -- <date>\nAvailable snapshots: ${available.join(", ") || "none"}`);
  process.exit(1);
}
const src = path.join(process.cwd(), "data", "snapshots", DATE, "database", `registry_snapshot_${DATE}.sqlite`);
const dest = path.join(process.cwd(), "data", "registry.db");
if (!fs.existsSync(src)) {
  console.error(`Snapshot database not found: ${src}`);
  process.exit(1);
}
if (fs.existsSync(dest)) {
  fs.copyFileSync(dest, dest + ".bak");
  console.log(`Existing database backed up to ${dest}.bak`);
}
fs.copyFileSync(src, dest);
console.log(`Restored ${DATE} snapshot to ${dest}. Set DATABASE_URL="file:../data/registry.db" and start the app.`);
