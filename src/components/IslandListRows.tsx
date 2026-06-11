import Link from "next/link";
import { ConflictBadge, StatusBadge, CompletenessBar } from "@/components/ui";

export interface IslandRow {
  id: string;
  slug: string;
  name: string;
  dhivehiName: string | null;
  atollName: string | null;
  status: string | null;
  areaSqKm: number | null;
  population: number | null;
  overallScore: number;
  unresolvedConflicts: number;
}

/** Responsive island list: table on desktop, cards on mobile. */
export default function IslandListRows({ islands }: { islands: IslandRow[] }) {
  if (!islands.length)
    return <div className="card p-8 text-center text-sm text-ink-soft">No islands match the current filters.</div>;
  return (
    <>
      <div className="hidden md:block card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Island</th><th>Atoll</th><th>Status</th><th>Population</th><th>Area (km²)</th>
              <th>Completeness</th><th>Conflicts</th>
            </tr>
          </thead>
          <tbody>
            {islands.map((i) => (
              <tr key={i.id}>
                <td>
                  <Link className="font-semibold text-ocean hover:underline" href={`/islands/${i.slug}`}>{i.name}</Link>
                  {i.dhivehiName && <span className="ml-2 text-ink-soft text-xs">{i.dhivehiName}</span>}
                </td>
                <td>{i.atollName ?? "—"}</td>
                <td><StatusBadge status={i.status} /></td>
                <td className="tabular-nums">{i.population?.toLocaleString() ?? "—"}</td>
                <td className="tabular-nums">{i.areaSqKm?.toFixed(2) ?? "—"}</td>
                <td className="min-w-[140px]"><CompletenessBar score={i.overallScore} /></td>
                <td>{i.unresolvedConflicts ? <ConflictBadge count={i.unresolvedConflicts} /> : <span className="text-xs text-ink-soft">none</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="md:hidden space-y-3">
        {islands.map((i) => (
          <li key={i.id}>
            <Link href={`/islands/${i.slug}`} className="card p-4 block">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-ocean truncate">{i.name}</span>
                <span className="flex gap-1 shrink-0">
                  <StatusBadge status={i.status} />
                  <ConflictBadge count={i.unresolvedConflicts} />
                </span>
              </div>
              <p className="text-xs text-ink-soft mt-1">
                {i.atollName ?? "—"}
                {i.population != null && <> · pop. {i.population.toLocaleString()}</>}
                {i.areaSqKm != null && <> · {i.areaSqKm.toFixed(2)} km²</>}
              </p>
              <div className="mt-2"><CompletenessBar score={i.overallScore} /></div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
