"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAuth } from "@/lib/api-client";
import { heroImageUrl } from "@/lib/media";
import { resolveTenantDisplayName, resolveTenantSlug } from "@/lib/tenant";
import { loginAction, registerCustomerAction } from "./actions";

export default function LoginPage() {
  const router = useRouter();
  const tenantSlug = useMemo(() => resolveTenantSlug(), []);
  const orgName = useMemo(() => resolveTenantDisplayName(), []);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    companyName: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res =
      mode === "login"
        ? await loginAction({
            email: form.email,
            password: form.password,
            tenantSlug,
          })
        : await registerCustomerAction({
            name: form.name.trim() || form.email.split("@")[0],
            email: form.email,
            password: form.password,
            tenantSlug,
            phone: form.phone || undefined,
            companyName: form.companyName || undefined,
          });

    setLoading(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    if (!("data" in res) || !res.data) {
      setError("Unexpected response");
      return;
    }

    saveAuth(res.data.accessToken, res.data.tenant.id);
    router.replace("/products");
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(115deg, rgba(18,26,22,0.92), rgba(30,61,50,0.75)), url(${heroImageUrl()})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-[color-mix(in_srgb,var(--paper)_94%,white)] shadow-[var(--shadow)]">
        <div className="bg-[#121a16] px-6 py-7 text-white">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--amber-soft)]">
            Customer portal
          </p>
          <h1 className="font-display mt-2 text-3xl font-semibold leading-tight">{orgName}</h1>
          <p className="mt-2 text-sm text-white/65">Order materials · track every stage</p>
        </div>

        <div className="p-6">
          <div className="mb-5 flex rounded-xl bg-[var(--mist)] p-1 text-sm font-semibold">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-lg py-2.5 ${mode === "login" ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--ink-soft)]/60"}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setForm({ name: "", email: "", password: "", phone: "", companyName: "" });
                setError("");
              }}
              className={`flex-1 rounded-lg py-2.5 ${mode === "register" ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--ink-soft)]/60"}`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === "register" && (
              <>
                <Field label="Your name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} required />
                <Field label="Company (optional)" value={form.companyName} onChange={(v) => setForm((f) => ({ ...f, companyName: v }))} />
                <Field label="Phone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
              </>
            )}
            <Field label="Email" type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} required />
            <Field label="Password" type="password" value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} required />
            {error && <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="btn-dark btn-dark-block disabled:opacity-60"
            >
              {loading
                ? mode === "login"
                  ? "Signing in…"
                  : "Creating account…"
                : mode === "login"
                  ? "Sign In"
                  : "Create account"}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-[var(--ink-soft)]/55">
          Need help signing in? Contact Trust Wood sales.
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
