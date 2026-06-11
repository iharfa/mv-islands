"use client";

import { useState } from "react";

export default function CorrectionForm() {
  const [form, setForm] = useState({ entityId: "", fieldName: "", oldValue: "", newValue: "", reason: "" });
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/admin/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setMsg(res.ok ? "Correction submitted to the review queue." : "Failed — all fields except old value are required.");
    if (res.ok) setForm({ entityId: "", fieldName: "", oldValue: "", newValue: "", reason: "" });
  }

  const field = (key: keyof typeof form, label: string, placeholder: string) => (
    <div>
      <label className="label-md text-ink-soft block mb-1" htmlFor={`corr-${key}`}>{label}</label>
      <input id={`corr-${key}`} value={form[key]} placeholder={placeholder}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full border border-border-subtle rounded px-3 py-2 text-sm min-h-[40px] focus:border-reef outline-none" />
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-3">
      {field("entityId", "Island slug or ID", "k-maafushi")}
      {field("fieldName", "Field name", "population_total")}
      {field("oldValue", "Old value (optional)", "")}
      {field("newValue", "Corrected value", "")}
      {field("reason", "Reason / evidence", "Official gazette no. …")}
      <button type="submit" className="btn btn-ocean w-full">Submit correction</button>
      {msg && <p className="text-xs text-ink-soft">{msg}</p>}
    </form>
  );
}
