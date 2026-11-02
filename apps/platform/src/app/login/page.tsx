"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { savePlatformAuth } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="relative flex min-h-screen items-center justify-center p-6">
      <div className="erp-login-wash pointer-events-none absolute inset-0" />
      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-md space-y-4 overflow-hidden rounded-3xl border border-white/12 bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] p-8 shadow-[var(--shadow-4)] backdrop-blur-md"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--brand)]">
            Platform
          </p>
          <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">WimFlo</h1>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">On business. one flow</p>
        </div>
        {error && (
          <p className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_40%,var(--line))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--surface))] px-4 py-2.5 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
        <label className="block text-sm text-[var(--ink-soft)]">
          Email
          <input
            className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-sunken)] px-3 py-2.5 text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand)]/35"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="username"
            required
          />
        </label>
        <label className="block text-sm text-[var(--ink-soft)]">
          Password
          <input
            className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-sunken)] px-3 py-2.5 text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand)]/35"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-[var(--brand)] px-4 py-3 font-semibold text-[var(--ink-inverse)] shadow-[0_0_24px_color-mix(in_srgb,var(--brand)_28%,transparent)] disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
