import { SectionTitle } from "@/components/ui";

export const metadata = { title: "API Documentation" };

interface Endpoint {
  method: string;
  path: string;
  description: string;
  params?: [string, string][];
  example: string;
  response: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: "GET", path: "/api/islands",
    description: "List islands with filters and pagination.",
    params: [
      ["atoll", "Atoll code, e.g. K, HDh"],
      ["status", "inhabited | uninhabited | resort | industrial | airport | agricultural"],
      ["q", "Name search (official or Dhivehi)"],
      ["conflicts", "true → only islands with unresolved conflicts"],
      ["min_completeness", "0–100 minimum overall completeness"],
      ["limit / offset", "Pagination (limit ≤ 2000)"],
    ],
    example: `curl "$BASE/api/islands?atoll=K&status=inhabited&limit=5"`,
    response: `{ "total": 1132, "count": 5, "islands": [ { "slug": "k-maafushi", "name": "Maafushi", "status": "inhabited", "overallScore": 78, "unresolvedConflicts": 2, "atoll": { "code": "K", "name": "Kaafu" }, … } ] }`,
  },
  {
    method: "GET", path: "/api/islands/{slug}",
    description: "Full island record: names, per-source geometries, population records, images, conflicts, match candidates and every source-attributed field value.",
    example: `curl "$BASE/api/islands/k-maafushi"`,
    response: `{ "island": { …, "population": [...], "conflicts": [...] }, "fieldValues": [ { "fieldName": "population_total", "rawValue": "1438", "isCanonical": true, "source": { "slug": "census-2022" }, "sourceUrl": "https://census.gov.mv/…", "dateScraped": "2026-06-11T…" } ] }`,
  },
  {
    method: "GET", path: "/api/atolls",
    description: "All 21 administrative atolls with island counts.",
    example: `curl "$BASE/api/atolls"`,
    response: `{ "atolls": [ { "code": "HA", "name": "Haa Alifu", "naturalAtoll": "Thiladhunmathi Uthuruburi", "_count": { "islands": 42 } } ] }`,
  },
  {
    method: "GET", path: "/api/atolls/{code}",
    description: "Single atoll with its islands and census population records.",
    example: `curl "$BASE/api/atolls/K"`,
    response: `{ "atoll": { "code": "K", "islands": [ … ] } }`,
  },
  {
    method: "GET", path: "/api/search",
    description: "Global search over island names (official / Dhivehi / alternative), atolls, statuses and types.",
    params: [["q", "Search term (required)"]],
    example: `curl "$BASE/api/search?q=maafushi"`,
    response: `{ "results": [ { "type": "island", "id": "k-maafushi", "label": "Maafushi — Kaafu", "href": "/islands/k-maafushi" } ] }`,
  },
  {
    method: "GET", path: "/api/conflicts",
    description: "Data conflicts with full per-source values.",
    params: [
      ["status", "unresolved | under_review | resolved | source_outdated | needs_external_confirmation"],
      ["severity", "low | medium | high | critical"],
      ["field", "Field name, e.g. population_total"],
      ["limit / offset", "Pagination"],
    ],
    example: `curl "$BASE/api/conflicts?severity=high&status=unresolved"`,
    response: `{ "total": 213, "conflicts": [ { "fieldName": "lat", "severity": "high", "canonicalValue": "4.0511", "sourceValues": "[{\\"source\\":\\"onemap\\",…}]" } ] }`,
  },
  {
    method: "GET", path: "/api/sources",
    description: "The full source registry incl. last scrape status and record counts.",
    example: `curl "$BASE/api/sources"`,
    response: `{ "sources": [ { "slug": "onemap", "priority": 10, "last_scrape_status": "success", "records_collected": 1561 } ] }`,
  },
  {
    method: "GET", path: "/api/snapshots",
    description: "Published data snapshots and their files with checksums.",
    example: `curl "$BASE/api/snapshots"`,
    response: `{ "snapshots": [ { "snapshotDate": "2026-06-11", "totalIslands": 1132, "files": [ { "path": "processed/islands_canonical.csv", "checksum": "…" } ] } ] }`,
  },
];

const DOWNLOADS = [
  "islands.geojson", "islands.csv", "islands-all-source-values.csv",
  "conflicts.csv", "source-registry.csv", "atolls.csv", "population.csv",
];

export default function ApiDocsPage() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 md:px-10 py-8 w-full">
      <SectionTitle>API Documentation</SectionTitle>
      <p className="text-sm text-ink-soft mb-2 max-w-3xl">
        Free, no-auth REST API. Base URL is this host. All responses are JSON unless noted.
        Every value traces to a source record — see the <a className="underline text-ocean" href="/sources">source registry</a>.
      </p>
      <p className="text-xs text-ink-soft mb-8">Please cache responses and keep request rates reasonable; this is public infrastructure.</p>

      {ENDPOINTS.map((e) => (
        <article key={e.path} className="card p-5 mb-5 overflow-hidden">
          <h2 className="font-semibold text-ink flex flex-wrap items-center gap-2">
            <span className="badge badge-info">{e.method}</span>
            <code className="text-ocean text-sm break-all">{e.path}</code>
          </h2>
          <p className="text-sm text-ink-soft mt-1.5">{e.description}</p>
          {e.params && (
            <div className="mt-3 overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Parameter</th><th>Description</th></tr></thead>
                <tbody>
                  {e.params.map(([p, d]) => (
                    <tr key={p}><td><code className="text-xs">{p}</code></td><td className="text-sm">{d}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <pre className="mt-3 bg-ocean-deep text-reef text-xs p-3 rounded overflow-x-auto">{e.example}</pre>
          <pre className="mt-2 bg-sand text-ink text-xs p-3 rounded overflow-x-auto whitespace-pre-wrap">{e.response}</pre>
        </article>
      ))}

      <article className="card p-5 mb-5">
        <h2 className="font-semibold text-ink flex items-center gap-2">
          <span className="badge badge-info">GET</span>
          <code className="text-ocean text-sm">/api/downloads/{"{file}"}</code>
        </h2>
        <p className="text-sm text-ink-soft mt-1.5">Bulk dataset downloads, generated live from the database.</p>
        <ul className="mt-3 grid sm:grid-cols-2 gap-2">
          {DOWNLOADS.map((f) => (
            <li key={f}>
              <a className="text-ocean underline text-sm break-all" href={`/api/downloads/${f}`}>/api/downloads/{f}</a>
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}
