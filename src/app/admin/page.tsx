import Link from "next/link";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { SectionTitle, StatCard, Badge, severityBadgeKind } from "@/components/ui";
import { prettyFieldName } from "@/components/FieldValueTable";
import AdminLogin from "@/components/AdminLogin";
import ConflictReviewActions from "@/components/ConflictReviewActions";
import CorrectionForm from "@/components/CorrectionForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin Dashboard" };

const COMMANDS = [
  ["Trigger all scrapers", "npm run scrape:onemap && npm run scrape:statsmap && npm run scrape:mbs && npm run scrape:atolls"],
  ["Run ETL pipeline", "npm run etl:normalize && npm run etl:match-islands && npm run etl:detect-conflicts && npm run etl:apply-source-policies"],
  ["Generate snapshot", "npm run snapshot:create && npm run snapshot:validate"],
  ["Export reports", "npm run export:csv && npm run export:geojson"],
];

export default async function AdminPage() {
  if (!(await isAdmin())) return <AdminLogin />;

  const [avgScores, unresolvedCount, reviewMatches, sources, queue, audit, failedRuns, corrections] = await Promise.all([
    prisma.island.aggregate({
      _avg: {
        overallScore: true, identityScore: true, geometryScore: true,
        populationScore: true, environmentScore: true, infrastructureScore: true, sourceScore: true,
      },
    }),
    prisma.dataConflict.count({ where: { status: "unresolved" } }),
    prisma.islandMatch.findMany({ where: { needsReview: true }, include: { island: { select: { slug: true, name: true } } }, take: 15 }),
    prisma.source.findMany({
      where: { category: { not: "future" } },
      include: { scrapeRuns: { orderBy: { startedAt: "desc" }, take: 1 } },
      orderBy: { priority: "asc" },
    }),
    prisma.dataConflict.findMany({
      where: { status: "unresolved", severity: { in: ["critical", "high", "medium"] } },
      include: { island: { select: { slug: true, name: true } } },
      orderBy: [{ severity: "asc" }, { detectedAt: "desc" }],
      take: 12,
    }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.scrapeRun.findMany({ where: { status: { in: ["failed", "partial"] } }, include: { source: true }, orderBy: { startedAt: "desc" }, take: 5 }),
    prisma.adminCorrection.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const reviewMatchCount = await prisma.islandMatch.count({ where: { needsReview: true } });

  const dims: [string, number | null][] = [
    ["Overall", avgScores._avg.overallScore], ["Identity", avgScores._avg.identityScore],
    ["Geometry", avgScores._avg.geometryScore], ["Population", avgScores._avg.populationScore],
    ["Environment", avgScores._avg.environmentScore], ["Infrastructure", avgScores._avg.infrastructureScore],
    ["Source coverage", avgScores._avg.sourceScore],
  ];

  return (
    <div className="mx-auto max-w-[1440px] px-4 md:px-10 py-8 w-full">
      <SectionTitle>Administrative Dashboard</SectionTitle>
      <p className="text-sm text-ink-soft mb-6">System overview and data moderation. All actions are written to the audit log.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        <StatCard label="Data quality score" value={`${Math.round(avgScores._avg.overallScore ?? 0)}%`} hint="avg completeness" />
        <StatCard label="Open conflict reviews" value={unresolvedCount.toLocaleString()} href="/conflicts?status=unresolved" />
        <StatCard label="Low-confidence matches" value={reviewMatchCount} hint="need manual review" />
        <StatCard label="Pending corrections" value={corrections.filter((c) => c.status === "pending").length} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-8">
          {/* Source health */}
          <section>
            <h2 className="text-lg font-semibold text-ocean mb-3">Source health</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {sources.map((s) => {
                const run = s.scrapeRuns[0];
                return (
                  <div key={s.id} className="card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm truncate">{s.name}</p>
                      <Badge kind={run?.status === "success" ? "verified" : run?.status === "partial" ? "pending" : run ? "error" : "neutral"}>
                        {run?.status ?? "never run"}
                      </Badge>
                    </div>
                    <p className="text-xs text-ink-soft mt-1 tabular-nums">
                      {run ? `${run.recordsFound.toLocaleString()} records · ${run.failures} failures · ${run.startedAt.toISOString().slice(0, 16).replace("T", " ")}` : "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Conflict review queue */}
          <section>
            <h2 className="text-lg font-semibold text-ocean mb-3">Conflict review queue</h2>
            <div className="space-y-3">
              {queue.map((c) => {
                const values: { source: string; rawValue?: string; normalizedValue?: string; note?: string }[] = JSON.parse(c.sourceValues);
                return (
                  <div key={c.id} className="card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-sm">
                        {c.island ? <Link className="text-ocean underline" href={`/islands/${c.island.slug}?tab=conflicts`}>{c.island.name}</Link> : "registry"}
                        <span className="text-ink-soft font-normal"> · {prettyFieldName(c.fieldName)} · {c.conflictType}</span>
                      </p>
                      <Badge kind={severityBadgeKind(c.severity)}>{c.severity}</Badge>
                    </div>
                    <ul className="mt-1.5 text-xs space-y-0.5 text-ink-soft">
                      {values.slice(0, 4).map((v, i) => (
                        <li key={i}><strong>{v.source}:</strong> {v.note ?? v.normalizedValue ?? v.rawValue ?? "—"}</li>
                      ))}
                    </ul>
                    {c.conflictType === "duplicate" ? (
                      <Link className="btn btn-ocean mt-2 inline-flex min-h-[36px] px-3 py-1 text-xs items-center" href={`/admin/duplicates/${c.id}`}>
                        Review side by side →
                      </Link>
                    ) : (
                      <ConflictReviewActions conflictId={c.id} />
                    )}
                  </div>
                );
              })}
              {!queue.length && <p className="text-sm text-ink-soft">Queue is empty.</p>}
            </div>
          </section>

          {/* Match review queue */}
          <section>
            <h2 className="text-lg font-semibold text-ocean mb-3">Low-confidence match queue</h2>
            <div className="card overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Island</th><th>Source</th><th>Record key</th><th>Method</th><th>Confidence</th></tr></thead>
                <tbody>
                  {reviewMatches.map((m) => (
                    <tr key={m.id}>
                      <td><Link className="text-ocean underline" href={`/islands/${m.island.slug}`}>{m.island.name}</Link></td>
                      <td>{m.sourceSlug}</td>
                      <td className="text-xs max-w-[220px] truncate" title={m.sourceRecordKey}>{m.sourceRecordKey}</td>
                      <td className="text-xs">{m.matchMethod}</td>
                      <td className="tabular-nums">{Math.round(m.confidence * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Audit history */}
          <section>
            <h2 className="text-lg font-semibold text-ocean mb-3">Audit history</h2>
            <ul className="card divide-y divide-border-subtle">
              {audit.map((a) => (
                <li key={a.id} className="px-4 py-2.5 text-sm flex flex-wrap justify-between gap-2">
                  <span><strong>{a.actor}</strong> · {a.action}{a.entityId ? ` · ${a.entityId.slice(-8)}` : ""}</span>
                  <span className="text-xs text-ink-soft tabular-nums">{a.createdAt.toISOString().slice(0, 19).replace("T", " ")}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-6">
          {/* Completeness report */}
          <section className="card p-5">
            <h2 className="font-semibold text-ocean mb-3">Completeness report</h2>
            <ul className="space-y-2 text-sm">
              {dims.map(([label, v]) => (
                <li key={label} className="flex items-center justify-between gap-3">
                  <span>{label}</span>
                  <span className="font-bold tabular-nums">{Math.round(v ?? 0)}%</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Failed source report */}
          <section className="card p-5">
            <h2 className="font-semibold text-ocean mb-3">Failed source report</h2>
            {failedRuns.length ? (
              <ul className="space-y-2 text-sm">
                {failedRuns.map((r) => (
                  <li key={r.id}>
                    <p className="font-medium">{r.source.name} <Badge kind="error">{r.status}</Badge></p>
                    <p className="text-xs text-ink-soft">{r.failures} failed URLs · {r.startedAt.toISOString().slice(0, 10)}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-soft">No failed or partial runs. 🎉</p>}
          </section>

          {/* Correction form */}
          <section className="card p-5">
            <h2 className="font-semibold text-ocean mb-3">Submit correction</h2>
            <CorrectionForm />
            {corrections.length > 0 && (
              <ul className="mt-4 text-xs text-ink-soft space-y-1">
                {corrections.slice(0, 5).map((c) => (
                  <li key={c.id}>{c.fieldName} → {c.newValue} <Badge kind={c.status === "approved" ? "verified" : c.status === "rejected" ? "error" : "pending"}>{c.status}</Badge></li>
                ))}
              </ul>
            )}
          </section>

          {/* Ops commands */}
          <section className="card p-5">
            <h2 className="font-semibold text-ocean mb-3">Operations</h2>
            <p className="text-xs text-ink-soft mb-3">Pipelines run via CLI or the weekly GitHub Actions workflow (<code className="bg-sand px-1 rounded">data-snapshot.yml</code>).</p>
            <ul className="space-y-3">
              {COMMANDS.map(([label, cmd]) => (
                <li key={label}>
                  <p className="text-sm font-medium">{label}</p>
                  <pre className="bg-ocean-deep text-reef text-[10px] p-2 rounded overflow-x-auto mt-1">{cmd}</pre>
                </li>
              ))}
            </ul>
          </section>

          {/* Satellite placeholder */}
          <section className="card p-5 border-dashed">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-ocean">Satellite acquisition</h2>
              <Badge kind="pending">planned</Badge>
            </div>
            <p className="text-sm text-ink-soft mt-2">Sentinel-2 imagery sync for island change detection is a planned capability. No acquisitions yet.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
