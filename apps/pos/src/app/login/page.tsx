"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@erp/ui";
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

    if (!email) {
      setError("Email is required");
      return;
    }
    if (!email.includes("@")) {
      setError("Enter a valid email");
      return;
    }
    if (!password) {
      setError("Password is required");
      return;
    }

    setLoading(true);

    const res = await api<{
      data?: {
        accessToken?: string;
        user?: { id: string };
        tenant?: { id: string };
        tenants?: { id: string }[];
      };
      accessToken?: string;
      token?: string;
      user?: { id: string };
      tenant?: { id: string };
      tenants?: { id: string }[];
    }>("gateway", "/api/auth?action=login", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({ email, password, tenantSlug: tenantSlug || undefined }),
    });

    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }

    const payload = res.data?.data ?? res.data;
    const token = payload?.accessToken ?? res.data?.accessToken ?? res.data?.token ?? "";
    const tenantId = payload?.tenant?.id ?? payload?.tenants?.[0]?.id ?? "";
    const userId = payload?.user?.id ?? "";

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--canvas)] px-4">
      <div className="mb-8 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">Counter</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-[var(--ink)]">POS Terminal</h1>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">Trust Wood</p>
      </div>

      <div className="w-full max-w-sm rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-raised)] p-6 shadow-[var(--shadow)]">
        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="cashier@store.com"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
          <Input
            label="Store code"
            type="text"
            placeholder="trustwood-enterprise (optional)"
            value={form.tenantSlug}
            onChange={(e) => setForm((f) => ({ ...f, tenantSlug: e.target.value }))}
          />
          {error ? (
            <div className="rounded-[var(--radius-sm)] border border-[var(--danger)]/40 bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] px-4 py-2.5 text-sm text-[var(--danger)]">
              {error}
            </div>
          ) : null}
          <Button type="submit" size="block" loading={loading} disabled={loading}>
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
