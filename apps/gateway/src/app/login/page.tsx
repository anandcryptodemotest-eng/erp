"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveAuth } from "@/lib/admin-api";
import { defaultHomePath, resolveNavModules } from "@/lib/nav-access";

const BRAND = "Trust Wood";
/** Internal tenant slug in DB — not shown as grocery brand */
const DEFAULT_TENANT_SLUG = "simhapuri-fresh";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    tenantSlug: DEFAULT_TENANT_SLUG,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          email: form.email,
          password: form.password,
          tenantSlug: form.tenantSlug || DEFAULT_TENANT_SLUG,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Login failed");
      const user = {
        id: json.data.user?.id as string | undefined,
        email: json.data.user?.email as string,
        name: (json.data.user?.name as string | null) ?? null,
        role: (json.data.user?.role as string) ?? "USER",
        navModules: (json.data.navModules as string[] | undefined) ?? null,
      };
      saveAuth(json.data.accessToken, json.data.tenant.id, user);
      const home = defaultHomePath(resolveNavModules(user.role, user.navModules));
      router.push(home);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(115deg, rgba(18,26,22,0.92), rgba(30,61,50,0.75)), url(/admin/products/hero-yard.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-[color-mix(in_srgb,var(--paper)_94%,white)] shadow-[var(--shadow)]">
        <div className="bg-[#121a16] px-6 py-7 text-white">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--amber-soft)]">
            Admin portal
          </p>
          <h1 className="font-display mt-2 text-3xl font-semibold leading-tight">{BRAND}</h1>
          <p className="mt-2 text-sm text-white/65">Catalog · orders · dispatch</p>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={(v) => setForm((f) => ({ ...f, email: v }))}
              required
            />
            <Field
              label="Password"
              type="password"
              value={form.password}
              onChange={(v) => setForm((f) => ({ ...f, password: v }))}
              required
            />
            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
            )}
            <button type="submit" disabled={loading} className="btn-dark btn-dark-block disabled:opacity-60">
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-[var(--ink-soft)]/55">
            Staff access for {BRAND} operations
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-[var(--ink-soft)]">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--amber)]/35"
      />
    </div>
  );
}
