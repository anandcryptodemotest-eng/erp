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
    setError("");

    const email = form.email.trim();
    const password = form.password;
    const tenantSlug = form.tenantSlug.trim();

    if (!email) { setError("Email is required"); return; }
    if (!email.includes("@")) { setError("Enter a valid email"); return; }
    if (!password) { setError("Password is required"); return; }

    setLoading(true);

    const res = await api<{
      data?: { accessToken?: string; user?: { id: string }; tenant?: { id: string }; tenants?: { id: string }[] };
      accessToken?: string;
      token?: string;
      user?: { id: string };
      tenant?: { id: string };
      tenants?: { id: string }[];
    }>(
      "gateway", "/api/auth?action=login",
      { method: "POST", skipAuth: true, body: JSON.stringify({ email, password, tenantSlug: tenantSlug || undefined }) }
    );

    setLoading(false);
    if (res.error) { setError(res.error); return; }

    const payload = res.data.data ?? res.data;
    const token = payload.accessToken ?? res.data.accessToken ?? res.data.token ?? "";
    const tenantId = payload.tenant?.id ?? payload.tenants?.[0]?.id ?? "";
    const userId = payload.user?.id ?? "";

    if (!tenantId) {
      setError("No tenant is assigned to this user. Ask a system admin to add you to a tenant.");
      return;
    }
    if (!token) {
      setError("Login token missing in response. Please retry.");
      return;
    }

    saveAuth(token, tenantId, userId);
    router.replace("/");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-4">
      <div className="mb-8 text-center">
        <div className="text-4xl mb-2">🖥️</div>
        <h1 className="text-2xl font-bold text-white">POS Terminal</h1>
        <p className="mt-1 text-sm text-slate-400">Simhapuri Fresh</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl bg-slate-800 p-6 shadow-xl border border-slate-700">
        <form onSubmit={handleLogin} className="space-y-4">
          {[
            { key: "email",      label: "Email",      type: "email",    placeholder: "cashier@store.com" },
            { key: "password",   label: "Password",   type: "password", placeholder: "••••••••" },
            { key: "tenantSlug", label: "Store Code", type: "text",     placeholder: "simhapuri-fresh (optional)" },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
              <input type={type} placeholder={placeholder}
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500" />
            </div>
          ))}
          {error && <div className="rounded-xl bg-red-900/40 border border-red-700 px-4 py-2.5 text-sm text-red-300">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
