"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface IslandOption {
  id: string;
  slug: string;
  name: string;
}

/**
 * Resolution actions for a duplicate-name conflict: the reviewer picks which
 * island is the primary record. The decision is recorded on the conflict
 * (status + reviewer note + audit trail) — neither island is deleted.
 */
export default function DuplicateResolveActions({
  conflictId,
  islands,
}: {
  conflictId: string;
  islands: [IslandOption, IslandOption];
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function resolve(primary: IslandOption) {
    setBusy(true);
    const other = islands.find((i) => i.id !== primary.id)!;
    await fetch(`/api/admin/conflicts/${conflictId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "resolved",
        reviewerNote:
          `Duplicate review: ${primary.name} (${primary.slug}) confirmed as the primary record; ` +
          `${other.name} (${other.slug}) retained for audit.` +
          (note ? ` Note: ${note}` : ""),
      }),
    });
    setBusy(false);
    router.push("/admin");
    router.refresh();
  }

  async function keepBoth() {
    setBusy(true);
    await fetch(`/api/admin/conflicts/${conflictId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "resolved",
        reviewerNote:
          "Duplicate review: both records confirmed as distinct islands sharing a name." +
          (note ? ` Note: ${note}` : ""),
      }),
    });
    setBusy(false);
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="card p-4 space-y-3">
      <p className="font-semibold text-sm text-ocean">Resolution</p>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Reviewer note (optional)…"
        aria-label="Reviewer note"
        className="w-full border border-border-subtle rounded px-3 py-2 text-sm min-h-[40px] focus:border-reef outline-none"
      />
      <div className="flex flex-wrap gap-2">
        {islands.map((isl) => (
          <button
            key={isl.id}
            disabled={busy}
            onClick={() => resolve(isl)}
            className="btn btn-ocean min-h-[40px] px-4 text-sm disabled:opacity-50"
          >
            {isl.name} ({isl.slug.split("-").pop()}) is primary
          </button>
        ))}
        <button
          disabled={busy}
          onClick={keepBoth}
          className="btn btn-secondary min-h-[40px] px-4 text-sm disabled:opacity-50"
        >
          Both are distinct islands
        </button>
      </div>
      <p className="text-[11px] text-ink-soft">
        The decision is recorded on the conflict with an audit trail. No island record is deleted — the
        non-primary record stays in the registry for transparency.
      </p>
    </div>
  );
}
