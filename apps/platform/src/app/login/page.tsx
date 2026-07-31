"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { savePlatformAuth } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("platform@erp.local");
  const [password, setPassword] = useState("Platform@123");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Login failed");
      savePlatformAuth(json.data.accessToken, json.data.refreshToken, json.data.operator);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-8 space-y-4 shadow-2xl"
      >
        <div>
          <p className="text-xs uppercase tracking-widest text-[var(--muted)]">SaaS operations</p>
          <h1 className="text-2xl font-semibold mt-1">Platform Admin</h1>
        </div>
        {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
        <label className="block text-sm text-[var(--muted)]">
          Email
          <input
            className="mt-1 w-full rounded-lg border border-[var(--line)] bg-black/20 px-3 py-2 text-[var(--text)]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </label>
        <label className="block text-sm text-[var(--muted)]">
          Password
          <input
            className="mt-1 w-full rounded-lg border border-[var(--line)] bg-black/20 px-3 py-2 text-[var(--text)]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
