"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (res.ok) router.refresh();
    else setError("Invalid token.");
  }

  return (
    <div className="mx-auto max-w-md w-full px-4 py-16">
      <form onSubmit={submit} className="card p-6 space-y-4">
        <h1 className="text-xl font-bold text-ocean">Admin access</h1>
        <p className="text-sm text-ink-soft">
          Placeholder authentication — set <code className="bg-sand px-1 rounded text-xs">ADMIN_TOKEN</code> in the
          environment and enter it below. Replace with SSO before multi-user production use.
        </p>
        <label className="label-md text-ink-soft block" htmlFor="admin-token">Admin token</label>
        <input
          id="admin-token" type="password" value={token} onChange={(e) => setToken(e.target.value)}
          className="w-full border border-border-subtle rounded px-3 py-2.5 min-h-[44px] focus:border-reef outline-none"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="submit" className="btn btn-ocean w-full">Sign in</button>
      </form>
    </div>
  );
}
