import Link from "next/link";
import { prisma } from "@/lib/db";
import { SectionTitle, StatCard, Badge, severityBadgeKind } from "@/components/ui";
import { prettyFieldName } from "@/components/FieldValueTable";
import ConflictCharts from "@/components/ConflictCharts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Data Conflicts Dashboard" };

const PAGE_SIZE = 50;
const STATUSES = ["unresolved", "under_review", "resolved", "source_outdated", "needs_external_confirmation"];
const STATUS_HELP: Record<string, string> = {
  unresolved: "Disagreement detected, not yet reviewed",
  under_review: "A reviewer is actively investigating",
  resolved: "Reviewed; canonical value confirmed with reason",
  source_outdated: "One source is known to carry stale data",
  needs_external_confirmation: "Requires confirmation from the source agency",
};

export default async function ConflictsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; severity?: string; field?: string; atoll?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const where = {
    ...(sp.status ? { status: sp.status } : {}),
    ...(sp.severity ? { severity: sp.severity } : {}),
    ...(sp.field ? { fieldName: sp.field } : {}),
    ...(sp.atoll ? { island: { atoll: { code: sp.atoll } } } : {}),
  };

  const monthAgo = new Date(Date.now() - 30 * 86400e3);
  const [total, unresolved, severe, recentResolved, conflicts, filteredTotal, fieldGroups, sevGroups, atolls, fieldsAll] =
    await Promise.all([
      prisma.dataConflict.count(),
      prisma.dataConflict.count({ where: { status: "unresolved" } }),
      prisma.dataConflict.count({ where: { severity: { in: ["high", "critical"] } } }),
      prisma.dataConflict.count({ where: { status: "resolved", reviewedAt: { gte: monthAgo } } }),
      prisma.dataConflict.findMany({
        where,
        include: { island: { select: { slug: true, name: true, atoll: { select: { code: true, name: true } } } } },
        orderBy: [{ status: "asc" }, { detectedAt: "desc" }],
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
      }),
      prisma.dataConflict.count({ where }),
      prisma.dataConflict.groupBy({ by: ["fieldName"], _count: { _all: true }, orderBy: { _count: { fieldName: "desc" } }, take: 10 }),
      prisma.dataConflict.groupBy({ by: ["severity"], _count: { _all: true } }),
      prisma.atoll.findMany({ orderBy: { code: "asc" } }),
      prisma.dataConflict.findMany({ distinct: ["fieldName"], select: { fieldName: true }, orderBy: { fieldName: "asc" } }),
    ]);

  // Conflicts by atoll (top 10)
  const byAtollRaw = await prisma.island.findMany({
    where: { unresolvedConflicts: { gt: 0 } },
    select: { unresolvedConflicts: true, atoll: { select: { code: true } } },
  });
  const atollCounts = new Map<string, number>();
  for (const i of byAtollRaw) {
    const code = i.atoll?.code ?? "—";
    atollCounts.set(code, (atollCounts.get(code) ?? 0) + i.unresolvedConflicts);
  }
  const byAtoll = [...atollCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  const pages = Math.ceil(filteredTotal / PAGE_SIZE);
  const qs = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...overrides })) if (v) params.set(k, String(v));
    return `?${params.toString()}`;
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 md:px-10 py-8 w-full">
      <SectionTitle action={<a className="btn btn-secondary" href="/api/downloads/conflicts.csv">Download conflicts.csv</a>}>
        Data Conflicts Dashboard
      </SectionTitle>
      <p className="text-sm text-ink-soft mb-6 max-w-3xl">
        When sources disagree, the registry records every value and publishes the disagreement here.
        Conflicts are never silently resolved — resolutions carry a reviewer note and an audit trail.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        <StatCard label="Total conflicts" value={total.toLocaleString()} />
        <StatCard label="Unresolved" value={unresolved.toLocaleString()} hint="awaiting review" />
        <StatCard label="High / critical severity" value={severe.toLocaleString()} />
        <StatCard label="Resolved (30 days)" value={recentResolved.toLocaleString()} />
      </div>

      <ConflictCharts
        byField={fieldGroups.map((g) => ({ name: prettyFieldName(g.fieldName), count: g._count._all }))}
        bySeverity={sevGroups.map((g) => ({ name: g.severity, count: g._count._all }))}
        byAtoll={byAtoll}
      />

      <details className="card p-4 mb-5 lg:open" open>
        <summary className="font-semibold text-ocean cursor-pointer min-h-[44px] flex items-center">Filters</summary>
        <form method="GET" className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className="border border-border-subtle rounded px-3 py-2.5 min-h-[44px] bg-white">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select name="severity" defaultValue={sp.severity ?? ""} aria-label="Severity" className="border border-border-subtle rounded px-3 py-2.5 min-h-[44px] bg-white">
            <option value="">All severities</option>
            {["low", "medium", "high", "critical"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select name="field" defaultValue={sp.field ?? ""} aria-label="Field" className="border border-border-subtle rounded px-3 py-2.5 min-h-[44px] bg-white">
            <option value="">All fields</option>
            {fieldsAll.map((f) => <option key={f.fieldName} value={f.fieldName}>{prettyFieldName(f.fieldName)}</option>)}
          </select>
          <select name="atoll" defaultValue={sp.atoll ?? ""} aria-label="Atoll" className="border border-border-subtle rounded px-3 py-2.5 min-h-[44px] bg-white">
            <option value="">All atolls</option>
            {atolls.map((a) => <option key={a.code} value={a.code}>{a.name} ({a.code})</option>)}
          </select>
          <button className="btn btn-ocean" type="submit">Apply</button>
        </form>
      </details>

      <p className="text-xs text-ink-soft mb-3 tabular-nums">{filteredTotal.toLocaleString()} conflicts match.</p>

      {/* Desktop table */}
      <div className="hidden lg:block card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr><th>ID</th><th>Island</th><th>Atoll</th><th>Field</th><th>Canonical</th><th>Source values</th><th>Severity</th><th>Status</th><th>Detected</th><th>Reviewed</th></tr>
          </thead>
          <tbody>
            {conflicts.map((c) => {
              const values: { source: string; rawValue?: string; normalizedValue?: string; note?: string }[] = JSON.parse(c.sourceValues);
              return (
                <tr key={c.id}>
                  <td className="text-xs tabular-nums">{c.id.slice(-6)}</td>
                  <td>{c.island ? <Link className="text-ocean underline" href={`/islands/${c.island.slug}?tab=conflicts`}>{c.island.name}</Link> : "—"}</td>
                  <td>{c.island?.atoll?.code ?? "—"}</td>
                  <td className="text-xs">{prettyFieldName(c.fieldName)}</td>
                  <td className="max-w-[160px] truncate" title={c.canonicalValue ?? ""}>{c.canonicalValue ?? "—"}</td>
                  <td className="max-w-[260px]">
                    <details>
                      <summary className="cursor-pointer text-xs text-ocean">{values.length} value{values.length > 1 ? "s" : ""}</summary>
                      <ul className="mt-1 text-xs space-y-0.5">
                        {values.map((v, i) => (
                          <li key={i}><strong>{v.source}:</strong> {v.note ?? v.normalizedValue ?? v.rawValue ?? "—"}</li>
                        ))}
                      </ul>
                    </details>
                  </td>
                  <td><Badge kind={severityBadgeKind(c.severity)}>{c.severity}</Badge></td>
                  <td><Badge kind={c.status === "resolved" ? "verified" : c.status === "unresolved" ? "error" : "pending"}>{c.status}</Badge></td>
                  <td className="text-xs tabular-nums">{c.detectedAt.toISOString().slice(0, 10)}</td>
                  <td className="text-xs tabular-nums">{c.reviewedAt?.toISOString().slice(0, 10) ?? "—"}{c.reviewerNote ? ` · ${c.reviewerNote}` : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="lg:hidden space-y-3">
        {conflicts.map((c) => {
          const values: { source: string; rawValue?: string; normalizedValue?: string; note?: string }[] = JSON.parse(c.sourceValues);
          return (
            <li key={c.id} className="card p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm">
                  {c.island ? <Link className="text-ocean underline" href={`/islands/${c.island.slug}?tab=conflicts`}>{c.island.name}</Link> : "Registry"}
                  <span className="text-ink-soft font-normal"> · {prettyFieldName(c.fieldName)}</span>
                </span>
                <Badge kind={severityBadgeKind(c.severity)}>{c.severity}</Badge>
              </div>
              <ul className="mt-2 text-xs space-y-0.5">
                {values.map((v, i) => (
                  <li key={i}><strong>{v.source}:</strong> {v.note ?? v.normalizedValue ?? v.rawValue ?? "—"}</li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-ink-soft">
                <Badge kind={c.status === "resolved" ? "verified" : c.status === "unresolved" ? "error" : "pending"}>{c.status}</Badge>
                <span className="ml-2 tabular-nums">detected {c.detectedAt.toISOString().slice(0, 10)}</span>
              </p>
            </li>
          );
        })}
      </ul>

      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Pagination">
          {page > 1 && <Link className="btn btn-secondary" href={qs({ page: String(page - 1) })}>← Prev</Link>}
          <span className="text-sm text-ink-soft px-2 tabular-nums">Page {page} / {pages}</span>
          {page < pages && <Link className="btn btn-secondary" href={qs({ page: String(page + 1) })}>Next →</Link>}
        </nav>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-ocean mb-3">Conflict status definitions</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {STATUSES.map((s) => (
            <div key={s} className="card p-4">
              <Badge kind={s === "resolved" ? "verified" : s === "unresolved" ? "error" : "pending"}>{s}</Badge>
              <p className="text-sm text-ink-soft mt-2">{STATUS_HELP[s]}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
