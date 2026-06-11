/**
 * Generates a PostgreSQL-compatible SQL dump from the local SQLite registry.
 * Used when no live Postgres is available (e.g. CI / local dev): the dump can
 * be restored with `psql -f postgres_dump_<date>.sql`.
 */
import Database from "better-sqlite3";
import fs from "node:fs";

const TYPE_MAP: Record<string, string> = {
  TEXT: "TEXT", INTEGER: "BIGINT", REAL: "DOUBLE PRECISION",
  BLOB: "BYTEA", NUMERIC: "NUMERIC", DATETIME: "TIMESTAMPTZ", BOOLEAN: "BOOLEAN",
};

export function generatePgDump(sqlitePath: string, outPath: string): { tables: number; rows: number } {
  const db = new Database(sqlitePath, { readonly: true });
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'")
    .all() as { name: string }[];

  const out: string[] = [
    "-- Maldives Island Registry — PostgreSQL dump",
    `-- Generated ${new Date().toISOString()} from ${sqlitePath}`,
    "-- Restore: createdb island_registry && psql island_registry -f thisfile.sql",
    "BEGIN;",
  ];
  let totalRows = 0;

  for (const { name } of tables) {
    const cols = db.prepare(`PRAGMA table_info("${name}")`).all() as {
      name: string; type: string; notnull: number; pk: number;
    }[];
    const colDefs = cols.map((c) => {
      const baseType = TYPE_MAP[c.type.toUpperCase()] ?? "TEXT";
      return `  "${c.name}" ${baseType}${c.pk ? " PRIMARY KEY" : c.notnull ? " NOT NULL" : ""}`;
    });
    out.push(`\nDROP TABLE IF EXISTS "${name}" CASCADE;`);
    out.push(`CREATE TABLE "${name}" (\n${colDefs.join(",\n")}\n);`);

    const rows = db.prepare(`SELECT * FROM "${name}"`).all() as Record<string, unknown>[];
    totalRows += rows.length;
    const colNames = cols.map((c) => `"${c.name}"`).join(", ");
    const isBool = new Set(cols.filter((c) => c.type.toUpperCase() === "BOOLEAN").map((c) => c.name));
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const values = batch
        .map((r) =>
          `(${cols.map((c) => {
            const v = r[c.name];
            if (v === null || v === undefined) return "NULL";
            if (isBool.has(c.name)) return v ? "TRUE" : "FALSE";
            if (typeof v === "number" || typeof v === "bigint") {
              // SQLite stores datetimes as ms epoch for Prisma DateTime columns
              if (/At$|^date|Date$/.test(c.name) && Number(v) > 1e12)
                return `to_timestamp(${Number(v) / 1000})`;
              return String(v);
            }
            return `'${String(v).replace(/'/g, "''")}'`;
          }).join(", ")})`,
        )
        .join(",\n");
      if (batch.length) out.push(`INSERT INTO "${name}" (${colNames}) VALUES\n${values};`);
    }
  }
  out.push("COMMIT;");
  fs.writeFileSync(outPath, out.join("\n"));
  db.close();
  return { tables: tables.length, rows: totalRows };
}
