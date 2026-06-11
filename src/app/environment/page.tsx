import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { SectionTitle, StatCard, SourceLine, Badge, EmptyState } from "@/components/ui";
import EnvironmentMap from "@/components/EnvironmentMap";

export const dynamic = "force-dynamic";
export const metadata = { title: "Environmental Dashboard" };

const STATSMAP_URL = "https://statisticsmaldives.gov.mv/gismaps/statsmap/";

interface LayerInfo { count: number | null; mtime: Date | null }

function layerInfo(file: string): LayerInfo {
  const full = path.join(process.cwd(), "data", "raw", "statsmap", file);
  if (!fs.existsSync(full)) return { count: null, mtime: null };
  try {
    const fc = JSON.parse(fs.readFileSync(full, "utf8"));
    return { count: fc.features?.length ?? 0, mtime: fs.statSync(full).mtime };
  } catch {
    return { count: null, mtime: null };
  }
}

interface PaProps { Name_Engli?: string; Atoll?: string; Category?: string; Type?: string; Area_Ha?: string; Date_Decla?: string }

function protectedAreas(): PaProps[] {
  const full = path.join(process.cwd(), "data", "raw", "statsmap", "ProtectedAreaEPA_25.geojson");
  if (!fs.existsSync(full)) return [];
  try {
    const fc = JSON.parse(fs.readFileSync(full, "utf8"));
    return (fc.features ?? []).map((f: { properties: PaProps }) => f.properties);
  } catch {
    return [];
  }
}

const PLANNED = [
  { title: "Coral Health Index", detail: "Reef health survey values will come from a future EPA / Marine Research Institute dataset. No values are shown because none have been ingested — this registry never invents data." },
  { title: "Marine Protected Area progress", detail: "MPA coverage against national targets requires the official EPA protected-area gazette dataset (planned source: epa-protected-areas)." },
  { title: "Biodiversity records", detail: "Species records, bird counts and invasive species beyond the Atolls of Maldives historical notes await a structured biodiversity dataset." },
  { title: "Mangrove inventory", detail: "A dedicated mangrove dataset is planned; current wetland polygons from StatsMap are unattributed by type." },
];

export default async function EnvironmentPage() {
  const pa = layerInfo("ProtectedAreaEPA_25.geojson");
  const reefs = layerInfo("Reef_0.geojson");
  const wetlands = layerInfo("wetland_6.geojson");
  const veg = layerInfo("veg_3.geojson");
  const areas = protectedAreas();

  const byAtoll = new Map<string, number>();
  for (const a of areas) byAtoll.set(a.Atoll ?? "?", (byAtoll.get(a.Atoll ?? "?") ?? 0) + 1);
  const atollRows = [...byAtoll.entries()].sort((a, b) => b[1] - a[1]);

  const stat = (info: LayerInfo, label: string) => (
    <div className="card p-4 md:p-5">
      <p className="label-md text-ink-soft">{label}</p>
      <p className="mt-1 text-2xl md:text-3xl font-bold text-island tabular-nums">
        {info.count ?? "—"}
      </p>
      {info.count === null ? (
        <p className="mt-1 text-xs text-warning font-semibold">Not yet ingested</p>
      ) : (
        <SourceLine sourceName="EPA via MBS StatsMap" sourceUrl={STATSMAP_URL} dateScraped={info.mtime!} />
      )}
    </div>
  );

  return (
    <div>
      <section className="bg-ocean text-white">
        <div className="mx-auto max-w-[1440px] px-4 md:px-10 py-10">
          <p className="label-md text-reef mb-2">Environmental Dashboard</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Environmental Integrity Report</h1>
          <p className="mt-3 text-white/75 text-sm max-w-2xl">
            Consolidated geospatial and environmental overview for the Maldives.
          </p>
          <div className="mt-4"><Badge kind="info">Aggregated from EPA layers via MBS StatsMap · disclaimer applies</Badge></div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-4 md:px-10 py-8 w-full">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
          {stat(pa, "Protected areas (EPA)")}
          {stat(reefs, "Coral reef polygons")}
          {stat(wetlands, "Wetland polygons")}
          {stat(veg, "Vegetated areas")}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-border-subtle flex items-center justify-between">
              <h2 className="font-semibold text-ocean">Protected areas & reefs</h2>
              <Link href="/map" className="text-xs underline text-ocean">Open full Map Explorer →</Link>
            </div>
            <EnvironmentMap />
            <p className="px-4 py-2 text-[11px] text-ink-soft">
              Layers: EPA protected areas (green), reefs (turquoise). © EPA / MBS StatsMap, © OpenStreetMap.
            </p>
          </div>

          <div className="card overflow-hidden">
            <div className="p-4 border-b border-border-subtle">
              <h2 className="font-semibold text-ocean">Protected areas by atoll</h2>
              <p className="text-xs text-ink-soft">Counts from the EPA layer ({areas.length} sites)</p>
            </div>
            {atollRows.length ? (
              <div className="max-h-[420px] overflow-y-auto">
                <table className="data-table">
                  <thead><tr><th>Atoll</th><th>Protected sites</th></tr></thead>
                  <tbody>
                    {atollRows.map(([atoll, n]) => (
                      <tr key={atoll}><td>{atoll}</td><td className="tabular-nums">{n}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6"><EmptyState title="EPA layer not ingested" detail="Run npm run scrape:statsmap" /></div>
            )}
          </div>
        </div>

        <SectionTitle>Largest protected areas</SectionTitle>
        {areas.length ? (
          <>
            <div className="hidden md:block card overflow-x-auto mb-8">
              <table className="data-table">
                <thead><tr><th>Name</th><th>Atoll</th><th>Type</th><th>Category</th><th>Area (ha)</th><th>Declared</th></tr></thead>
                <tbody>
                  {[...areas].sort((a, b) => Number(b.Area_Ha ?? 0) - Number(a.Area_Ha ?? 0)).slice(0, 12).map((a, i) => (
                    <tr key={i}>
                      <td className="font-medium">{a.Name_Engli ?? "—"}</td>
                      <td>{a.Atoll ?? "—"}</td>
                      <td>{a.Type ?? "—"}</td>
                      <td className="text-xs">{a.Category ?? "—"}</td>
                      <td className="tabular-nums">{a.Area_Ha ?? "—"}</td>
                      <td className="tabular-nums">{a.Date_Decla ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="md:hidden space-y-3 mb-8">
              {[...areas].sort((a, b) => Number(b.Area_Ha ?? 0) - Number(a.Area_Ha ?? 0)).slice(0, 8).map((a, i) => (
                <li key={i} className="card p-4">
                  <p className="font-semibold text-ink text-sm">{a.Name_Engli ?? "—"}</p>
                  <p className="text-xs text-ink-soft mt-1">{a.Atoll} · {a.Type} · {a.Area_Ha} ha · declared {a.Date_Decla ?? "—"}</p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyState title="No protected-area data available" detail="The EPA layer has not been ingested yet." />
        )}

        <SectionTitle>Planned datasets</SectionTitle>
        <div className="grid sm:grid-cols-2 gap-3 md:gap-4">
          {PLANNED.map((p) => (
            <div key={p.title} className="card p-5 border-dashed">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="font-semibold text-ink">{p.title}</h3>
                <Badge kind="pending">planned — not yet available</Badge>
              </div>
              <p className="text-sm text-ink-soft">{p.detail}</p>
              <Link href="/sources" className="text-xs underline text-ocean mt-2 inline-block">Source registry →</Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
