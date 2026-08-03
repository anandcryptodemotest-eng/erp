"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Chip, ChipGroup, Input } from "@erp/ui";
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
      <div className="relative w-full max-w-md overflow-hidden rounded-[var(--radius)] border border-white/15 bg-[color-mix(in_srgb,var(--paper)_94%,white)] shadow-[var(--shadow)]">
        <div className="bg-[var(--ink)] px-6 py-7 text-white">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--amber-soft)]">
            Customer portal
          </p>
          <h1 className="font-display mt-2 text-3xl font-semibold leading-tight">{orgName}</h1>
          <p className="mt-2 text-sm text-white/65">Order materials · track every stage</p>
        </div>

        <div className="p-6">
          <ChipGroup className="mb-5">
            <Chip active={mode === "login"} onClick={() => setMode("login")} className="flex-1 justify-center">
              Sign in
            </Chip>
            <Chip
              active={mode === "register"}
              onClick={() => {
                setMode("register");
                setForm({ name: "", email: "", password: "", phone: "", companyName: "" });
                setError("");
              }}
              className="flex-1 justify-center"
            >
              Register
            </Chip>
          </ChipGroup>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === "register" ? (
              <>
                <Field
                  label="Your name"
                  value={form.name}
                  onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                  required
                />
                <Field
                  label="Company (optional)"
                  value={form.companyName}
                  onChange={(v) => setForm((f) => ({ ...f, companyName: v }))}
                />
                <Field
                  label="Phone"
                  value={form.phone}
                  onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                />
              </>
            ) : null}
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
            {error ? (
              <div className="rounded-[var(--radius)] bg-red-50 px-4 py-2.5 text-sm text-[var(--danger)]">
                {error}
              </div>
            ) : null}
            <Button type="submit" size="block" loading={loading} disabled={loading}>
              {mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-[var(--ink-soft)]">
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
      <Input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[var(--touch-min)] rounded-[var(--radius)] border-[var(--line)] focus-visible:ring-[var(--forest)]"
      />
    </div>
  );
}
