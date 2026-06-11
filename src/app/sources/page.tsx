import { sourceRegistryRows } from "@/lib/exports";
import { SectionTitle, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Source Registry" };

const CATEGORY_LABELS: Record<string, string> = {
  onemap: "OneMap Maldives",
  census: "Census 2022",
  statsmap: "MBS StatsMap",
  indicators: "Indicator Sheets",
  atolls: "Atolls of Maldives",
  manual: "Manual Verification",
  future: "Planned / Future Sources",
};

function scrapeBadge(status: string) {
  if (status === "success") return <Badge kind="verified">last scrape: success</Badge>;
  if (status === "partial") return <Badge kind="pending">last scrape: partial</Badge>;
  if (status === "failed") return <Badge kind="error">last scrape: failed</Badge>;
  return <Badge kind="neutral">never scraped</Badge>;
}

export default async function SourcesPage() {
  const sources = await sourceRegistryRows();
  const groups = new Map<string, typeof sources>();
  for (const s of sources) groups.set(s.category, [...(groups.get(s.category) ?? []), s]);

  return (
    <div className="mx-auto max-w-[1440px] px-4 md:px-10 py-8 w-full">
      <SectionTitle>Source Registry</SectionTitle>
      <p className="text-sm text-ink-soft mb-6 max-w-3xl">
        Every public data point on this portal links back to one of these sources. Canonical values
        are selected by the priority order below; lower-priority values are always retained and
        published. Raw archives live under <code className="bg-sand px-1 rounded">data/raw/</code> in the repository.
      </p>

      {[...groups.entries()].map(([category, items]) => (
        <section key={category} className="mb-8">
          <h2 className="text-lg font-semibold text-ocean mb-3">{CATEGORY_LABELS[category] ?? category}</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {items.map((s) => (
              <article key={s.slug} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-semibold text-ink">{s.name}</h3>
                    <p className="text-xs text-ink-soft">{s.organization}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {category === "future" ? <Badge kind="neutral">planned</Badge> : scrapeBadge(s.last_scrape_status as string)}
                    <Badge kind="info">priority {String(s.priority)}</Badge>
                  </div>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm mt-3">
                  <div><dt className="label-md text-ink-soft">URL</dt>
                    <dd><a href={String(s.url)} target="_blank" rel="noopener noreferrer" className="text-ocean underline break-all">{String(s.url)}</a></dd></div>
                  <div><dt className="label-md text-ink-soft">Dataset type / access</dt><dd>{String(s.dataset_type)} · {String(s.access_method)}</dd></div>
                  <div><dt className="label-md text-ink-soft">Last scrape</dt><dd className="tabular-nums">{s.last_scrape ? String(s.last_scrape).slice(0, 19).replace("T", " ") : "—"}</dd></div>
                  <div><dt className="label-md text-ink-soft">Records collected</dt><dd className="tabular-nums">{Number(s.records_collected).toLocaleString()} (run) · {Number(s.field_values).toLocaleString()} field values · {Number(s.documents)} documents</dd></div>
                  <div><dt className="label-md text-ink-soft">License / terms</dt><dd>{String(s.license || "Not formally published")}</dd></div>
                  <div><dt className="label-md text-ink-soft">Raw archive</dt><dd><code className="bg-sand px-1 rounded text-xs">{String(s.archive_path || "—")}</code></dd></div>
                  <div className="sm:col-span-2"><dt className="label-md text-ink-soft">Processing script</dt><dd><code className="bg-sand px-1 rounded text-xs">{String(s.processing_script || "—")}</code></dd></div>
                  <div className="sm:col-span-2"><dt className="label-md text-ink-soft">Known limitations</dt><dd className="text-ink-soft">{String(s.limitations || "—")}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
