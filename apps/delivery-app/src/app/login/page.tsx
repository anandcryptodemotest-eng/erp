"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveAuth } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");

    const res = await fetch(`${process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:3010"}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", email, password, tenantSlug }),
    });
    const json = await res.json();
    setLoading(false);

    if (!res.ok) { setError(json.error ?? "Login failed"); return; }

    const token = json.token;
    const tenantId = json.tenant?.id ?? json.tenants?.[0]?.id ?? "";
    const userId = json.user?.id ?? "";

    saveAuth(token, tenantId, userId);
    router.push("/home");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-orange-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-5xl mb-3">🛵</div>
          <h1 className="text-2xl font-bold text-orange-600">Simhapuri Fresh</h1>
          <p className="text-sm text-stone-500 mt-1">Delivery Executive App</p>
        </div>

        <form onSubmit={handleLogin} className="rounded-2xl bg-white shadow-sm border border-orange-100 p-6 space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Store / Tenant</label>
            <input value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} required
              placeholder="simhapuri-fresh"
              className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-orange-400" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              placeholder="exec@example.com"
              className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-orange-400" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              placeholder="••••••••"
              className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-orange-400" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full rounded-xl bg-orange-500 py-3 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50">
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
