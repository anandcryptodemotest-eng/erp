"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, saveAuth } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", tenantSlug: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");

    const res = await api<{ token: string; tenant?: { id: string }; tenants?: { id: string }[] }>(
      "gateway", "/api/auth",
      { method: "POST", skipAuth: true, body: JSON.stringify({ action: "login", ...form }) }
    );

    setLoading(false);
    if (res.error) { setError(res.error); return; }

    const tenantId = res.data.tenant?.id ?? res.data.tenants?.[0]?.id ?? "";
    if (!tenantId) { setError("Tenant not found for this account"); return; }

    saveAuth(res.data.token, tenantId);
    router.replace("/");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-green-600 to-green-700 px-4">
      {/* Logo */}
      <div className="mb-8 text-center text-white">
        <div className="text-5xl mb-2">🌿</div>
        <h1 className="text-3xl font-bold tracking-tight">Simhapuri Fresh</h1>
        <p className="mt-1 text-sm opacity-80">Fresh groceries, delivered fast</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-5 text-xl font-bold text-gray-900">Sign in</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
            <input type="email" required value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-green-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Password</label>
            <input type="password" required value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-green-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Store Code</label>
            <input value={form.tenantSlug}
              onChange={(e) => setForm((f) => ({ ...f, tenantSlug: e.target.value }))}
              placeholder="your-store (optional)"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-green-500" />
          </div>
          {error && <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full rounded-full bg-green-600 py-3.5 text-base font-semibold text-white disabled:opacity-60">
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
