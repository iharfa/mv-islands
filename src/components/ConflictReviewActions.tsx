"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ACTIONS: [string, string][] = [
  ["resolved", "Approve canonical"],
  ["unresolved", "Mark unresolved"],
  ["source_outdated", "Source outdated"],
  ["needs_external_confirmation", "Needs confirmation"],
];

export default function ConflictReviewActions({ conflictId }: { conflictId: string }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function act(status: string) {
    setBusy(true);
    await fetch(`/api/admin/conflicts/${conflictId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reviewerNote: note || undefined }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mt-2 space-y-2">
      <input
        value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reviewer note…"
        aria-label="Reviewer note"
        className="w-full border border-border-subtle rounded px-3 py-2 text-sm min-h-[40px] focus:border-reef outline-none"
      />
      <div className="flex flex-wrap gap-1.5">
        {ACTIONS.map(([status, label]) => (
          <button key={status} disabled={busy} onClick={() => act(status)}
            className="btn btn-secondary min-h-[36px] px-3 py-1 text-xs disabled:opacity-50">
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
