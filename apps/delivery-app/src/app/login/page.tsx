"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Truck } from "@erp/ui";
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
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", email, password, tenantSlug }),
    });
    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json.error ?? "Login failed");
      return;
    }

    const token = json.token;
    const tenantId = json.tenant?.id ?? json.tenants?.[0]?.id ?? "";
    const userId = json.user?.id ?? "";

    saveAuth(token, tenantId, userId);
    router.push("/home");
  }

  return (
    <div className="erp-canvas flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-[var(--radius-md)] bg-[var(--mist)] text-[var(--accent)]">
            <Truck className="h-7 w-7" aria-hidden />
          </div>
          <h1 className="font-display text-2xl font-bold text-[var(--brand)]">Trust Wood</h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">Delivery executive</p>
        </div>

        <form
          onSubmit={handleLogin}
          className="space-y-4 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] p-6 shadow-[var(--shadow-1)]"
        >
          {error ? (
            <div className="rounded-[var(--radius-sm)] border border-[var(--danger)]/30 bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-4 py-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Store / Tenant</label>
            <Input
              value={tenantSlug}
              onChange={(e) => setTenantSlug(e.target.value)}
              required
              placeholder="trustwood-enterprise"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="exec@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
