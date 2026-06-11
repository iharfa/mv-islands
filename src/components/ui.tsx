import Link from "next/link";

/** Pill verification/status badge per Atoll Geometric design system. */
export function Badge({
  kind,
  children,
}: {
  kind: "verified" | "pending" | "error" | "info" | "neutral" | "conflict";
  children: React.ReactNode;
}) {
  return <span className={`badge badge-${kind}`}>{children}</span>;
}

export function ConflictBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="badge badge-conflict" title={`${count} unresolved data conflict${count > 1 ? "s" : ""}`}>
      ⚠ {count} conflict{count > 1 ? "s" : ""}
    </span>
  );
}

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge kind="neutral">unknown</Badge>;
  const kind =
    status === "inhabited" ? "info" : status === "resort" ? "pending" : status === "uninhabited" ? "neutral" : "verified";
  return <Badge kind={kind as never}>{status}</Badge>;
}

/** 0–100 data completeness indicator. */
export function CompletenessBar({ score, label }: { score: number; label?: string }) {
  const color = score >= 75 ? "#228B22" : score >= 40 ? "#E65100" : "#B71C1C";
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="h-2 flex-1 min-w-[48px] rounded-full bg-border-subtle overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold tabular-nums" style={{ color }}>
        {score}%{label ? ` ${label}` : ""}
      </span>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-ocean">{children}</h2>
      {action}
    </div>
  );
}

export function StatCard({ label, value, hint, href }: { label: string; value: React.ReactNode; hint?: string; href?: string }) {
  const inner = (
    <div className="card p-4 md:p-5 h-full hover:border-reef transition-colors">
      <p className="label-md text-ink-soft">{label}</p>
      <p className="mt-1 text-2xl md:text-3xl font-bold text-ocean tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

/** Source disclosure line shown under public data values. */
export function SourceLine({
  sourceName,
  sourceUrl,
  dateScraped,
  verificationStatus,
}: {
  sourceName: string;
  sourceUrl: string;
  dateScraped: string | Date;
  verificationStatus?: string;
}) {
  return (
    <p className="text-[11px] text-ink-soft">
      Source:{" "}
      <a href={sourceUrl} className="underline hover:text-ocean" target="_blank" rel="noopener noreferrer">
        {sourceName}
      </a>{" "}
      · scraped {new Date(dateScraped).toISOString().slice(0, 10)}
      {verificationStatus ? ` · ${verificationStatus}` : ""}
    </p>
  );
}

export function severityBadgeKind(severity: string): "neutral" | "pending" | "error" | "conflict" {
  return severity === "low" ? "neutral" : severity === "medium" ? "pending" : severity === "high" ? "error" : "conflict";
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="card p-8 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {detail && <p className="mt-1 text-sm text-ink-soft">{detail}</p>}
    </div>
  );
}
