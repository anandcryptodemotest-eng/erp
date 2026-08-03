"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveAuth } from "@/lib/admin-api";
import { defaultHomePath, resolveNavModules } from "@/lib/nav-access";

type PublicTenant = {
  slug: string;
  displayName: string;
  active: boolean;
  branding: { logo: string | null; accent: string; theme: string };
};

type PickerTenant = { slug: string; name: string; id: string };

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTenant = (searchParams.get("tenant") ?? "").trim().toLowerCase();

  const [form, setForm] = useState({
    email: "",
    password: "",
    tenantSlug: urlTenant,
  });
  const [resolved, setResolved] = useState<PublicTenant | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [picker, setPicker] = useState<PickerTenant[] | null>(null);

  const fromUrl = Boolean(urlTenant);
  const showOrgInput = !fromUrl && !resolved;

  const resolveSlug = useCallback(async (slug: string) => {
    const s = slug.trim().toLowerCase();
    if (!s) {
      setResolved(null);
      setOrgError(null);
      return;
    }
    setResolving(true);
    setOrgError(null);
    try {
      const res = await fetch(`/api/public/tenants/${encodeURIComponent(s)}`);
      const json = await res.json();
      if (!res.ok) {
        setResolved(null);
        setOrgError("Organization not found");
        return;
      }
      setResolved(json.data as PublicTenant);
      setForm((f) => ({ ...f, tenantSlug: (json.data as PublicTenant).slug }));
    } catch {
      setResolved(null);
      setOrgError("Organization not found");
    } finally {
      setResolving(false);
    }
  }, []);

  useEffect(() => {
    if (urlTenant) void resolveSlug(urlTenant);
  }, [urlTenant, resolveSlug]);

  const displayName = resolved?.displayName ?? "ERP Admin";
  const accent = resolved?.branding.accent ?? "#c8922a";
  const loginDisabled =
    loading || resolving || Boolean(orgError) || (fromUrl && !resolved);

  async function completeLogin(tenantSlug: string) {
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
          tenantSlug,
        }),
      });
      const json = await res.json();

      if (res.status === 409 && json.code === "TENANT_PICKER" && Array.isArray(json.tenants)) {
        setPicker(json.tenants as PickerTenant[]);
        setError("Select an organization to continue");
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "Login failed");

      const user = {
        id: json.data.user?.id as string | undefined,
        email: json.data.user?.email as string,
        name: (json.data.user?.name as string | null) ?? null,
        role: (json.data.user?.role as string) ?? "USER",
        navModules: (json.data.navModules as string[] | undefined) ?? null,
        capabilities: (json.data.capabilities as string[] | undefined) ?? null,
      };
      saveAuth(json.data.accessToken, json.data.tenant.id, user);
      const home = defaultHomePath(
        resolveNavModules(user.role, user.navModules, user.capabilities)
      );
      router.push(home);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPicker(null);
    const slug = form.tenantSlug.trim().toLowerCase();
    if (orgError || (fromUrl && !resolved)) {
      setError("Organization not found");
      return;
    }
    if (slug && !resolved) {
      const res = await fetch(`/api/public/tenants/${encodeURIComponent(slug)}`);
      if (!res.ok) {
        setOrgError("Organization not found");
        setError("Organization not found");
        return;
      }
      const json = await res.json();
      setResolved(json.data as PublicTenant);
      await completeLogin(slug);
      return;
    }
    await completeLogin(slug);
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
        <div
          className="px-6 py-7 text-white"
          style={{
            background: `linear-gradient(145deg, #121a16 0%, color-mix(in srgb, ${accent} 35%, #121a16) 100%)`,
          }}
        >
          <p
            className="text-[11px] font-bold uppercase tracking-[0.2em]"
            style={{ color: accent }}
          >
            Admin portal
          </p>
          <h1 className="font-display mt-2 text-3xl font-semibold leading-tight">{displayName}</h1>
          <p className="mt-2 text-sm text-white/65">
            {resolved ? "Catalog · orders · dispatch" : "Sign in to your organization"}
          </p>
          {resolving && <p className="mt-2 text-xs text-white/50">Looking up organization…</p>}
        </div>

        <div className="p-6">
          {picker && picker.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--ink-soft)]">Choose an organization</p>
              <ul className="space-y-2">
                {picker.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      disabled={loading}
                      className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-left text-sm hover:bg-[var(--mist)] disabled:opacity-60"
                      onClick={() => void completeLogin(t.slug)}
                    >
                      <span className="font-semibold text-[var(--ink)]">{t.name}</span>
                      <span className="mt-0.5 block font-mono text-xs text-[var(--ink-soft)]/70">
                        {t.slug}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {error && (
                <div className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">{error}</div>
              )}
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
              {showOrgInput && (
                <Field
                  label="Organization (optional if you belong to one)"
                  type="text"
                  value={form.tenantSlug}
                  onChange={(v) => {
                    setForm((f) => ({ ...f, tenantSlug: v.toLowerCase() }));
                    setOrgError(null);
                    setResolved(null);
                  }}
                  onBlur={() => {
                    if (form.tenantSlug.trim()) void resolveSlug(form.tenantSlug);
                  }}
                  placeholder="acme"
                />
              )}
              {fromUrl && resolved && (
                <p className="rounded-xl bg-[var(--mist)] px-3 py-2 text-xs text-[var(--ink-soft)]">
                  Organization · <span className="font-mono font-semibold">{resolved.slug}</span>
                </p>
              )}
              {orgError && (
                <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{orgError}</div>
              )}
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
              {error && !picker && (
                <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
              )}
              <button
                type="submit"
                disabled={loginDisabled}
                className="btn-dark btn-dark-block disabled:opacity-60"
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>
          )}
          <p className="mt-4 text-center text-xs text-[var(--ink-soft)]/55">
            {resolved
              ? `Staff access for ${displayName}`
              : "Use your organization link, or enter the organization slug"}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-[var(--ink-soft)]">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-[var(--ink-soft)]">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--amber)]/35"
      />
    </div>
  );
}
