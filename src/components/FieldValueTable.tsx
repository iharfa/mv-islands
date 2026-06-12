import { Badge } from "@/components/ui";

export interface FieldValueView {
  id: string;
  fieldName: string;
  rawValue: string | null;
  normalizedValue: string | null;
  isCanonical: boolean;
  canonicalReason: string | null;
  confidenceScore: number;
  verificationStatus: string;
  dateScraped: Date;
  datePublished: Date | null;
  dateVerified: Date | null;
  sourceUrl: string;
  notes: string | null;
  source: { slug: string; name: string };
}

export function prettyFieldName(field: string): string {
  return field
    .replace(/^(env|infra|history|notes|other) :: /, "")
    .replace(/.* :: /, "")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** Dated staleness notice, shown wherever Atolls of Maldives contributes values. */
export function AomDisclaimer() {
  return (
    <div className="card p-4 border-warning bg-sand/60" role="note">
      <p className="text-sm">
        <strong>⚠ Historical source notice.</strong> Values from <em>Atolls of Maldives</em> come from a
        government heritage archive whose island records were last observably updated in <strong>August 2024</strong> —
        and many entries date back to the 1990s–2010s (the site platform itself dates to 2013). Island status,
        use and ownership — resort, agricultural and industrial leases — may have changed since publication.
        Where current registries disagree, the registry prefers OneMap and Census 2022 values.
      </p>
    </div>
  );
}

/**
 * Source-comparison display for one field: canonical value followed by every
 * source's raw + normalized value, confidence, verification and scrape date.
 */
export default function FieldValueTable({
  fields,
  conflictFields,
  atollNameByCode,
}: {
  fields: Map<string, FieldValueView[]>;
  conflictFields: Set<string>;
  /** code → long name; when set, the canonical atoll value renders as "Long name (Code)". */
  atollNameByCode?: Record<string, string>;
}) {
  if (!fields.size) return null;
  const hasAom = [...fields.values()].some((vs) => vs.some((v) => v.source.slug === "atolls-of-maldives"));
  return (
    <div className="space-y-5">
      {hasAom && <AomDisclaimer />}
      {[...fields.entries()].map(([fieldName, values]) => {
        const canonical = values.find((v) => v.isCanonical) ?? values[0];
        const hasConflict = conflictFields.has(fieldName);
        let canonicalDisplay = canonical.normalizedValue ?? canonical.rawValue ?? "—";
        if (fieldName === "atoll" && atollNameByCode) {
          const longName = Object.entries(atollNameByCode).find(
            ([code]) => code.toLowerCase() === canonicalDisplay.toLowerCase(),
          )?.[1];
          if (longName) canonicalDisplay = `${longName} (${canonicalDisplay})`;
        }
        const longText = canonicalDisplay.length > 120;
        return (
          <section key={fieldName} className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-border-subtle flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-ink text-sm">{prettyFieldName(fieldName)}</h3>
              <div className="flex gap-1.5">
                {hasConflict && <Badge kind="conflict">⚠ sources disagree</Badge>}
                <Badge kind={values.length > 1 ? "info" : "neutral"}>{values.length} source{values.length > 1 ? "s" : ""}</Badge>
              </div>
            </div>
            <div className="px-4 py-3">
              <p className="label-md text-ink-soft mb-1">Canonical value</p>
              <p className={`font-semibold text-ocean ${longText ? "text-sm whitespace-pre-wrap leading-relaxed" : "text-lg"}`}>
                {canonicalDisplay}
              </p>
              {canonical.canonicalReason && (
                <p className="text-[11px] text-ink-soft mt-1">Why this value: {canonical.canonicalReason}</p>
              )}
            </div>
            {/* Desktop comparison table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Source</th><th>Raw value</th><th>Normalized</th><th>Confidence</th><th>Verification</th><th>Scraped</th><th></th></tr>
                </thead>
                <tbody>
                  {values.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <a href={v.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-ocean underline">{v.source.name}</a>
                      </td>
                      <td className="max-w-[280px] truncate" title={v.rawValue ?? ""}>{v.rawValue ?? "—"}</td>
                      <td className="max-w-[280px] truncate" title={v.normalizedValue ?? ""}>{v.normalizedValue ?? "—"}</td>
                      <td className="tabular-nums">{Math.round(v.confidenceScore * 100)}%</td>
                      <td><Badge kind={v.verificationStatus === "verified" ? "verified" : v.verificationStatus === "disputed" ? "error" : "neutral"}>{v.verificationStatus}</Badge></td>
                      <td className="tabular-nums text-xs">{v.dateScraped.toISOString().slice(0, 10)}</td>
                      <td>{v.isCanonical && <Badge kind="verified">canonical</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile stacked cards */}
            <ul className="md:hidden divide-y divide-border-subtle">
              {values.map((v) => (
                <li key={v.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <a href={v.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-ocean underline font-medium">{v.source.name}</a>
                    {v.isCanonical && <Badge kind="verified">canonical</Badge>}
                  </div>
                  <p className="mt-1 break-words">{v.normalizedValue ?? v.rawValue ?? "—"}</p>
                  <p className="text-[11px] text-ink-soft mt-1">
                    {Math.round(v.confidenceScore * 100)}% confidence · {v.verificationStatus} · scraped {v.dateScraped.toISOString().slice(0, 10)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
