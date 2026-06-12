import Link from "next/link";
import { prisma } from "@/lib/db";
import { SectionTitle, StatCard, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Data Downloads Catalog" };

const SNAPSHOT_DATE = "2026-06-11";

interface Item {
  name: string;
  href?: string;
  format: string;
  labels: ("canonical dataset" | "raw source data" | "conflict dataset" | "historical snapshot" | "geospatial" | "metadata")[];
  description: string;
}

const SECTIONS: { title: string; note?: string; items: Item[] }[] = [
  {
    title: "Canonical datasets",
    note: "Generated live from the registry database on every request.",
    items: [
      { name: "islands_canonical.csv", href: "/api/downloads/islands.csv", format: "CSV", labels: ["canonical dataset"], description: "One row per island: names, atoll, status, coordinates, area, completeness, conflict count." },
      { name: "islands_canonical.geojson", href: "/api/downloads/islands.geojson", format: "GeoJSON", labels: ["canonical dataset", "geospatial"], description: "Island polygons (OneMap geometry) with registry attributes." },
      { name: "atolls.csv", href: "/api/downloads/atolls.csv", format: "CSV", labels: ["canonical dataset"], description: "All 21 administrative atolls." },
      { name: "population.csv", href: "/api/downloads/population.csv", format: "CSV", labels: ["canonical dataset"], description: "Population records per island per source (Census 2022, StatsMap)." },
    ],
  },
  {
    title: "Raw source datasets",
    note: "Every source value, untransformed, with provenance — nothing is discarded.",
    items: [
      { name: "islands_all_source_values.csv", href: "/api/downloads/islands-all-source-values.csv", format: "CSV", labels: ["raw source data"], description: "The complete source-first value store: every field from every source with raw value, normalized value, confidence, verification status and scrape date." },
      { name: "data/raw/ archives", format: "files", labels: ["raw source data"], description: "Raw HTML, ArcGIS responses, XLSX tables and layer files archived per source in the repository (see Source Registry for paths)." },
    ],
  },
  {
    title: "Conflict datasets",
    items: [
      { name: "islands_conflicts.csv", href: "/api/downloads/conflicts.csv", format: "CSV", labels: ["conflict dataset"], description: "Every detected cross-source disagreement with all source values, severity and review status." },
      { name: "aom_data_issues.csv", href: "/api/downloads/aom-data-issues.csv", format: "CSV", labels: ["conflict dataset", "metadata"], description: "Known issues with Atolls of Maldives data: islands missing from the archive and every value where AoM disagrees with current registries (the archive's last observable update is August 2024; many records are older). Check this before reusing AoM data." },
    ],
  },
  {
    title: "Geospatial datasets",
    items: [
      { name: "Protected areas (EPA)", href: "/api/layers/protected-areas", format: "GeoJSON", labels: ["raw source data", "geospatial"], description: "93 protected sites from the EPA layer via MBS StatsMap." },
      { name: "Coral reefs", href: "/api/layers/reefs", format: "GeoJSON", labels: ["raw source data", "geospatial"], description: "Reef polygons from MBS StatsMap." },
      { name: "Wetlands", href: "/api/layers/wetlands", format: "GeoJSON", labels: ["raw source data", "geospatial"], description: "Wetland polygons from MBS StatsMap." },
      { name: "Atoll boundaries", href: "/api/layers/atoll-boundaries", format: "GeoJSON", labels: ["raw source data", "geospatial"], description: "Administrative atoll boundary lines." },
    ],
  },
  {
    title: "Source registry & metadata",
    items: [
      { name: "source_registry.csv", href: "/api/downloads/source-registry.csv", format: "CSV", labels: ["metadata"], description: "All registered sources with access methods, licenses, limitations and scrape stats." },
      { name: "Data dictionary", href: "/docs/data-dictionary", format: "Markdown", labels: ["metadata"], description: "Field-by-field documentation of every dataset." },
      { name: "Source inventory", href: "/docs/source-inventory", format: "Markdown", labels: ["metadata"], description: "Narrative inventory of each source and what was collected." },
    ],
  },
];

export default async function DownloadsPage() {
  const [snapshot, runs, sourcesCount, islands] = await Promise.all([
    prisma.snapshot.findFirst({ orderBy: { snapshotDate: "desc" }, include: { files: true } }),
    prisma.scrapeRun.findMany({ orderBy: { startedAt: "desc" }, take: 8, include: { source: { select: { name: true } } } }),
    prisma.source.count(),
    prisma.island.count(),
  ]);

  return (
    <div className="mx-auto max-w-[1440px] px-4 md:px-10 py-8 w-full">
      <SectionTitle action={<Link className="btn btn-secondary" href="/api-docs">API Documentation</Link>}>
        Dataset Download Catalog
      </SectionTitle>
      <p className="text-sm text-ink-soft mb-6 max-w-3xl">
        Official geospatial and statistical datasets for the Maldives, consolidated with full source
        disclosure. All data is free to reuse with attribution to the original sources.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-10">
        <StatCard label="Islands in registry" value={islands.toLocaleString()} />
        <StatCard label="Registered sources" value={sourcesCount} href="/sources" />
        <StatCard label="Latest snapshot" value={snapshot?.snapshotDate ?? SNAPSHOT_DATE} hint={snapshot ? "published" : "generating"} />
        <StatCard label="Update cadence" value="Weekly" hint="GitHub Actions snapshot workflow" />
      </div>

      {/* Latest full snapshot */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-ocean mb-3">Latest full snapshot</h2>
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">registry snapshot {snapshot?.snapshotDate ?? SNAPSHOT_DATE}</p>
              <p className="text-sm text-ink-soft mt-1">
                Raw archives + processed CSV/GeoJSON + SQLite database + PostgreSQL dump + manifest with checksums.
                Stored in the repository under <code className="bg-sand px-1 rounded text-xs">data/snapshots/{snapshot?.snapshotDate ?? SNAPSHOT_DATE}/</code> and attached to GitHub Releases as a ZIP.
              </p>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <Badge kind="info">historical snapshot</Badge>
              {snapshot ? <Badge kind="verified">published</Badge> : <Badge kind="pending">generating</Badge>}
            </div>
          </div>
          {snapshot && snapshot.files.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>File</th><th>Label</th><th>Size</th><th>SHA-256</th></tr></thead>
                <tbody>
                  {snapshot.files.map((f) => (
                    <tr key={f.id}>
                      <td className="text-xs font-medium">{f.path}</td>
                      <td><Badge kind="neutral">{f.label}</Badge></td>
                      <td className="tabular-nums text-xs">{(f.sizeBytes / 1024).toFixed(1)} KB</td>
                      <td className="text-[10px] tabular-nums max-w-[200px] truncate" title={f.checksum}>{f.checksum}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {SECTIONS.map((sec) => (
        <section key={sec.title} className="mb-10">
          <h2 className="text-lg font-semibold text-ocean mb-1">{sec.title}</h2>
          {sec.note && <p className="text-xs text-ink-soft mb-3">{sec.note}</p>}
          <div className="card divide-y divide-border-subtle">
            {sec.items.map((item) => (
              <div key={item.name} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{item.name}</p>
                  <p className="text-xs text-ink-soft mt-0.5">{item.description}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {item.labels.map((l) => (
                      <Badge key={l} kind={l === "canonical dataset" ? "verified" : l === "conflict dataset" ? "error" : l === "raw source data" ? "info" : "neutral"}>{l}</Badge>
                    ))}
                    <span className="badge badge-neutral">{item.format}</span>
                    <span className="badge badge-neutral">generated live</span>
                  </div>
                </div>
                {item.href ? (
                  <a className="btn btn-ocean shrink-0 w-full sm:w-auto" href={item.href}>Download</a>
                ) : (
                  <Link className="btn btn-secondary shrink-0 w-full sm:w-auto" href="/sources">View paths</Link>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Scrape reports */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-ocean mb-3">Recent scrape reports</h2>
        <div className="hidden md:block card overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Source</th><th>Status</th><th>Records</th><th>Pages</th><th>Failures</th><th>Started</th></tr></thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>{r.source.name}</td>
                  <td><Badge kind={r.status === "success" ? "verified" : r.status === "partial" ? "pending" : r.status === "running" ? "info" : "error"}>{r.status}</Badge></td>
                  <td className="tabular-nums">{r.recordsFound.toLocaleString()}</td>
                  <td className="tabular-nums">{r.pagesFetched}</td>
                  <td className="tabular-nums">{r.failures}</td>
                  <td className="tabular-nums text-xs">{r.startedAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="md:hidden space-y-3">
          {runs.map((r) => (
            <li key={r.id} className="card p-4 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-semibold">{r.source.name}</span>
                <Badge kind={r.status === "success" ? "verified" : r.status === "partial" ? "pending" : "error"}>{r.status}</Badge>
              </div>
              <p className="text-xs text-ink-soft mt-1 tabular-nums">{r.recordsFound.toLocaleString()} records · {r.failures} failures · {r.startedAt.toISOString().slice(0, 16).replace("T", " ")}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
