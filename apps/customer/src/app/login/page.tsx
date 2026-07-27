"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveAuth } from "@/lib/api-client";
import { loginAction } from "./actions";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "customer@oms.test",
    password: "Test@123",
    tenantSlug: "simhapuri-fresh",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await loginAction(form);

    setLoading(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    if (!("data" in res) || !res.data) {
      setError("Tenant not found for this account");
      return;
    }

    saveAuth(res.data.accessToken, res.data.tenant.id);
    router.replace("/products");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">OMS Customer Portal</h1>
        <p className="mt-1 text-sm text-slate-500">Place trading orders · track status</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
        <h2 className="mb-5 text-xl font-bold text-gray-900">Sign in</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Tenant</label>
            <input
              value={form.tenantSlug}
              onChange={(e) => setForm((f) => ({ ...f, tenantSlug: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
            />
          </div>
          {error && <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-slate-900 py-3.5 text-base font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
        <p className="mt-4 text-xs text-slate-400 text-center">Demo: customer@oms.test / Test@123</p>
      </div>
    </div>
  );
}
