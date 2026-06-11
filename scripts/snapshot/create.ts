/**
 * snapshot:create — builds a complete public data snapshot under
 * data/snapshots/<date>/ : raw archives, processed CSV/GeoJSON, metadata
 * (manifest, reports, checksums), SQLite copy and a PostgreSQL dump.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { exportCsvFiles } from "../export/csv";
import { exportGeoJson } from "../export/geojson";
import { generatePgDump } from "./pgdump";

const prisma = new PrismaClient();
const DATE = process.env.SNAPSHOT_DATE ?? new Date().toISOString().slice(0, 10);
const ROOT = process.cwd();
const SNAP = path.join(ROOT, "data", "snapshots", DATE);

function sha256(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function copyDir(src: string, dest: string) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  return true;
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}

async function main() {
  console.log(`Creating snapshot ${DATE}…`);
  for (const sub of ["raw", "processed", "metadata", "database"]) {
    fs.mkdirSync(path.join(SNAP, sub), { recursive: true });
  }

  // 1. Raw archives (saved before any transformation by the scrapers)
  const rawSources = ["atollsofmaldives", "onemap", "mbs", "statsmap"];
  const missingRaw: string[] = [];
  for (const s of rawSources) {
    const ok = copyDir(path.join(ROOT, "data", "raw", s), path.join(SNAP, "raw", s));
    if (!ok) missingRaw.push(s);
    console.log(`raw/${s}: ${ok ? "copied" : "MISSING"}`);
  }

  // 2. Processed exports
  await exportCsvFiles(path.join(SNAP, "processed"));
  await exportGeoJson(path.join(SNAP, "processed"));

  // 3. Database copies
  const sqliteSrc = path.join(ROOT, "data", "registry.db");
  const sqliteDest = path.join(SNAP, "database", `registry_snapshot_${DATE}.sqlite`);
  fs.copyFileSync(sqliteSrc, sqliteDest);
  const pg = generatePgDump(sqliteSrc, path.join(SNAP, "database", `postgres_dump_${DATE}.sql`));
  console.log(`database: sqlite copied, pg dump ${pg.tables} tables / ${pg.rows} rows`);

  // 4. Metadata reports
  const [islands, atolls, popRecords, conflicts, sources, runs] = await Promise.all([
    prisma.island.count(), prisma.atoll.count(), prisma.islandPopulation.count(),
    prisma.dataConflict.count(), prisma.source.findMany({ include: { scrapeRuns: { orderBy: { startedAt: "desc" }, take: 1 } } }),
    prisma.scrapeRun.findMany({ orderBy: { startedAt: "desc" }, include: { source: true } }),
  ]);
  const conflictsBySeverity = await prisma.dataConflict.groupBy({ by: ["severity"], _count: { _all: true } });
  const unresolvedConflicts = await prisma.dataConflict.count({ where: { status: "unresolved" } });

  const scrapeReport = [
    `# Scrape report — snapshot ${DATE}`, "",
    "| Source | Status | Records | Pages | Failures | Started |",
    "|---|---|---|---|---|---|",
    ...runs.map((r) =>
      `| ${r.source.name} | ${r.status} | ${r.recordsFound} | ${r.pagesFetched} | ${r.failures} | ${r.startedAt.toISOString()} |`),
    "",
    missingRaw.length ? `## Warnings\n\n- Missing raw archives: ${missingRaw.join(", ")} (partial snapshot)` : "All raw archives present.",
    "",
    "## Failed URLs", "",
    ...runs.filter((r) => r.failures > 0).map((r) => `### ${r.source.slug}\n\n\`\`\`\n${r.failedUrls}\n\`\`\``),
  ].join("\n");
  fs.writeFileSync(path.join(SNAP, "metadata", "scrape_report.md"), scrapeReport);

  const conflictReport = [
    `# Conflict report — snapshot ${DATE}`, "",
    `Total conflicts: **${conflicts}** (unresolved: **${unresolvedConflicts}**)`, "",
    "| Severity | Count |", "|---|---|",
    ...conflictsBySeverity.map((g) => `| ${g.severity} | ${g._count._all} |`),
    "",
    "Full detail: `processed/islands_conflicts.csv`. Conflicts are never auto-resolved;",
    "every source value is retained in `processed/islands_all_source_values.csv`.",
  ].join("\n");
  fs.writeFileSync(path.join(SNAP, "metadata", "conflict_report.md"), conflictReport);

  const sourceInventory = [
    `# Source inventory — snapshot ${DATE}`, "",
    ...sources.map((s) => [
      `## ${s.name}`,
      `- Organization: ${s.organization}`,
      `- URL: ${s.url}`,
      `- Type/access: ${s.datasetType} via ${s.accessMethod}`,
      `- Canonical priority: ${s.priority}`,
      `- License: ${s.license ?? "not formally published"}`,
      `- Limitations: ${s.limitations ?? "—"}`,
      `- Raw archive: ${s.archivePath ?? "—"}`,
      `- Processing script: ${s.processingScript ?? "—"}`,
      `- Last run: ${s.scrapeRuns[0] ? `${s.scrapeRuns[0].status} (${s.scrapeRuns[0].recordsFound} records, ${s.scrapeRuns[0].startedAt.toISOString()})` : "never"}`,
      "",
    ].join("\n")),
  ].join("\n");
  fs.writeFileSync(path.join(SNAP, "metadata", "source_inventory.md"), sourceInventory);

  // Data dictionary is maintained in docs/ and copied into the snapshot
  const dictSrc = path.join(ROOT, "docs", "data-dictionary.md");
  if (fs.existsSync(dictSrc)) fs.copyFileSync(dictSrc, path.join(SNAP, "metadata", "data_dictionary.md"));

  // 5. Checksums (everything except the checksum file itself)
  const files = walk(SNAP).filter((f) => !f.endsWith("checksums.sha256"));
  const checksumLines = files.map((f) => `${sha256(f)}  ${path.relative(SNAP, f).replace(/\\/g, "/")}`);
  fs.writeFileSync(path.join(SNAP, "metadata", "checksums.sha256"), checksumLines.join("\n"));

  // 6. Manifest
  let gitCommit: string | null = null;
  try { gitCommit = execSync("git rev-parse HEAD", { cwd: ROOT }).toString().trim(); } catch { /* not yet a repo */ }
  const appVersion = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
  const manifest = {
    snapshot_date: DATE,
    generated_at: new Date().toISOString(),
    git_commit_hash: gitCommit,
    app_version: appVersion,
    database_schema_version: fs.readdirSync(path.join(ROOT, "prisma", "migrations")).filter((d) => /^\d/.test(d)).pop() ?? null,
    sources_collected: sources.filter((s) => s.scrapeRuns.length).map((s) => s.slug),
    total_islands: islands,
    total_atolls: atolls,
    total_population_records: popRecords,
    total_conflicts: conflicts,
    unresolved_conflicts: unresolvedConflicts,
    files_included: files.map((f) => path.relative(SNAP, f).replace(/\\/g, "/")),
    checksums_file: "metadata/checksums.sha256",
    failed_sources: runs.filter((r) => r.status === "failed").map((r) => r.source.slug),
    warnings: missingRaw.map((s) => `raw archive missing for ${s}`),
    restore_instructions:
      "SQLite: copy database/registry_snapshot_" + DATE + ".sqlite to data/registry.db and set DATABASE_URL=file:../data/registry.db. " +
      "PostgreSQL: createdb island_registry && psql island_registry -f database/postgres_dump_" + DATE + ".sql. " +
      "Or run: npm run snapshot:restore -- " + DATE,
  };
  fs.writeFileSync(path.join(SNAP, "metadata", "snapshot_manifest.json"), JSON.stringify(manifest, null, 2));

  // 7. Register in DB
  const snap = await prisma.snapshot.upsert({
    where: { snapshotDate: DATE },
    create: {
      snapshotDate: DATE, generatedAt: new Date(), gitCommitHash: gitCommit, appVersion,
      schemaVersion: manifest.database_schema_version,
      totalIslands: islands, totalAtolls: atolls, totalPopulation: popRecords, totalConflicts: conflicts,
      manifest: JSON.stringify(manifest),
    },
    update: { generatedAt: new Date(), manifest: JSON.stringify(manifest), totalIslands: islands, totalAtolls: atolls, totalPopulation: popRecords, totalConflicts: conflicts },
  });
  await prisma.snapshotFile.deleteMany({ where: { snapshotId: snap.id } });
  const keyFiles = files.filter((f) => /processed|database|metadata/.test(f));
  for (const f of keyFiles) {
    const rel = path.relative(SNAP, f).replace(/\\/g, "/");
    await prisma.snapshotFile.create({
      data: {
        snapshotId: snap.id,
        path: rel,
        label: rel.startsWith("database") ? "database" : rel.startsWith("metadata") ? "metadata"
          : rel.includes("conflict") ? "conflict" : rel.endsWith(".geojson") ? "geospatial" : "canonical",
        sizeBytes: fs.statSync(f).size,
        checksum: sha256(f),
      },
    });
  }
  await prisma.auditLog.create({ data: { actor: "system", action: "snapshot:create", detail: `Snapshot ${DATE}: ${files.length} files` } });
  console.log(`Snapshot ${DATE} complete: ${files.length} files at ${SNAP}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); process.exit(1); });
