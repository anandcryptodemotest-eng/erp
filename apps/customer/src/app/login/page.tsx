"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Chip, ChipGroup, Input } from "@erp/ui";
import { saveAuth } from "@/lib/api-client";
import { ensureCustomerProfile } from "@/lib/ensure-customer-profile";
import { heroImageUrl } from "@/lib/media";
import {
  fetchTenantBranding,
  rememberQueryTenant,
  resolveTenantSlug,
  tenantSlugFromBrowser,
} from "@/lib/tenant";
import {
  loginAction,
  registerCustomerAction,
  googleLoginAction,
  otpStartAction,
  otpVerifyAction,
} from "./actions";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (resp: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: { theme?: string; size?: string; width?: number; text?: string }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/shop";
  const tenantSlug = useMemo(() => {
    const fromUrl = (
      searchParams.get("tenant") ??
      searchParams.get("t") ??
      tenantSlugFromBrowser()
    )
      .trim()
      .toLowerCase();
    if (fromUrl) rememberQueryTenant(fromUrl);
    return fromUrl || resolveTenantSlug();
  }, [searchParams]);
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    const slug =
      (searchParams.get("tenant") ?? searchParams.get("t") ?? tenantSlugFromBrowser()).trim().toLowerCase() ||
      tenantSlug;
    if (!slug) return;
    rememberQueryTenant(slug);
    void fetchTenantBranding(slug).then((b) => {
      if (b?.displayName) setOrgName(b.displayName);
    });
  }, [searchParams, tenantSlug]);
  const [googleError, setGoogleError] = useState("");

  const [mode, setMode] = useState<"login" | "register" | "otp">("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    companyName: "",
    otp: "",
  });
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function completeGoogleLogin(idToken: string) {
    setLoading(true);
    setError("");
    setGoogleError("");
    const res = await googleLoginAction({
      idToken,
      tenantSlug: tenantSlugFromBrowser() || tenantSlug,
    });
    setLoading(false);
    if ("error" in res && res.error) {
      setGoogleError(res.error);
      return;
    }
    if (!("data" in res) || !res.data) {
      setGoogleError("Unexpected response");
      return;
    }
    saveAuth(res.data.accessToken, res.data.tenant.id);
    const name = res.data.user.name ?? "Customer";
    await ensureCustomerProfile({
      name,
      email: res.data.user.email,
      phone: undefined,
    });
    try {
      localStorage.setItem("customer_display_name", name);
    } catch {
      /* ignore */
    }
    const dest = returnTo.startsWith("/") ? returnTo : "/shop";
    router.replace(dest);
  }

  function initGoogleButton(ref: HTMLDivElement | null) {
    if (!ref || typeof window === "undefined" || !window.google?.accounts) return;
    if (!GOOGLE_CLIENT_ID) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (resp) => {
        if (resp?.credential) void completeGoogleLogin(resp.credential);
      },
      auto_select: false,
      cancel_on_tap_outside: false,
    });
    window.google.accounts.id.renderButton(ref, {
      theme: "outline",
      size: "large",
      width: 320,
      text: "continue_with",
    });
  }

  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const existing = document.getElementById("google-gsi-script");
    if (existing) {
      // Ensure button renders once script is loaded (already loaded case).
      const poll = window.setInterval(() => {
        if (window.google?.accounts) {
          initGoogleButton(googleButtonRef.current);
          window.clearInterval(poll);
        }
      }, 150);
      return () => window.clearInterval(poll);
    }
    const script = document.createElement("script");
    script.id = "google-gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => initGoogleButton(googleButtonRef.current);
    document.body.appendChild(script);
    return () => {
      /* keep script loaded across re-renders */
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finishAuth(res: Awaited<ReturnType<typeof loginAction>>, phone?: string) {
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    if (!("data" in res) || !res.data) {
      setError("Unexpected response");
      return;
    }

    saveAuth(res.data.accessToken, res.data.tenant.id);
    const displayName =
      res.data.user.name ?? form.name ?? form.email.split("@")[0] ?? "Customer";
    await ensureCustomerProfile({
      name: displayName,
      email: res.data.user.email ?? form.email,
      phone: phone || form.phone || undefined,
    });
    try {
      localStorage.setItem("customer_display_name", displayName);
    } catch {
      /* ignore */
    }
    const dest = returnTo.startsWith("/") ? returnTo : "/shop";
    router.replace(dest);
  }

  async function handleOtpStart() {
    setLoading(true);
    setError("");
    const res = await otpStartAction({
      phone: form.phone,
      tenantSlug: tenantSlugFromBrowser() || tenantSlug,
    });
    setLoading(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    if ("data" in res) setOtpSentTo(res.data.phone);
  }

  async function handleOtpVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await otpVerifyAction({
      phone: form.phone,
      code: form.otp,
      name: form.name.trim() || undefined,
      tenantSlug: tenantSlugFromBrowser() || tenantSlug,
    });
    setLoading(false);
    await finishAuth(res, form.phone);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "otp") {
      if (otpSentTo) {
        await handleOtpVerify(e);
        return;
      }
      await handleOtpStart();
      return;
    }
    setLoading(true);
    setError("");

    const slug = tenantSlugFromBrowser() || tenantSlug;
    const res =
      mode === "login"
        ? await loginAction({
            email: form.email,
            password: form.password,
            tenantSlug: slug,
          })
        : await registerCustomerAction({
            name: form.name.trim() || form.email.split("@")[0],
            email: form.email,
            password: form.password,
            tenantSlug: slug,
            phone: form.phone || undefined,
            companyName: form.companyName || undefined,
          });

    setLoading(false);
    await finishAuth(res);
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
      <div className="relative w-full max-w-md overflow-hidden rounded-[var(--radius-md)] border border-white/15 bg-[color-mix(in_srgb,var(--paper)_94%,white)] shadow-[var(--shadow)]">
        <div className="bg-[var(--ink)] px-6 py-7 text-white">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--amber-soft)]">
            Customer portal
          </p>
          <h1 className="font-display mt-2 text-3xl font-semibold leading-tight">
            {orgName || "Customer portal"}
          </h1>
          <p className="mt-2 text-sm text-white/65">Order materials · track every stage</p>
          {tenantSlug ? (
            <p className="mt-2 font-mono text-[11px] text-white/50">{tenantSlug}</p>
          ) : null}
        </div>

        <div className="p-6">
          <ChipGroup className="mb-5">
            <Chip
              active={mode === "login"}
              onClick={() => {
                setMode("login");
                setOtpSentTo(null);
                setError("");
              }}
              className="flex-1 justify-center"
            >
              Sign in
            </Chip>
            <Chip
              active={mode === "register"}
              onClick={() => {
                setMode("register");
                setForm({ name: "", email: "", password: "", phone: "", companyName: "", otp: "" });
                setOtpSentTo(null);
                setError("");
              }}
              className="flex-1 justify-center"
            >
              Register
            </Chip>
            <Chip
              active={mode === "otp"}
              onClick={() => {
                setMode("otp");
                setOtpSentTo(null);
                setError("");
              }}
              className="flex-1 justify-center"
            >
              WhatsApp
            </Chip>
          </ChipGroup>

          {mode !== "otp" && GOOGLE_CLIENT_ID ? (
            <div className="mb-4">
              <div ref={googleButtonRef} className="flex justify-center" />
              <div className="my-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-soft)]/60">
                <span className="h-px flex-1 bg-[var(--line)]" />
                or
                <span className="h-px flex-1 bg-[var(--line)]" />
              </div>
            </div>
          ) : null}
          {googleError ? (
            <div className="mb-4 rounded-[var(--radius-md)] bg-red-50 px-4 py-2.5 text-sm text-[var(--danger)]">
              {googleError}
            </div>
          ) : null}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
            {mode === "otp" ? (
              <>
                <Field
                  label="Your name (new accounts)"
                  value={form.name}
                  onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                />
                <Field
                  label="WhatsApp number"
                  value={form.phone}
                  onChange={(v) => {
                    setForm((f) => ({ ...f, phone: v }));
                    setOtpSentTo(null);
                  }}
                  required
                />
                {otpSentTo ? (
                  <Field
                    label="6-digit code"
                    value={form.otp}
                    onChange={(v) => setForm((f) => ({ ...f, otp: v }))}
                    required
                  />
                ) : null}
              </>
            ) : (
              <>
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
              </>
            )}
            {error ? (
              <div className="rounded-[var(--radius-md)] bg-red-50 px-4 py-2.5 text-sm text-[var(--danger)]">
                {error}
              </div>
            ) : null}
            <Button type="submit" size="block" loading={loading} disabled={loading}>
              {mode === "otp"
                ? otpSentTo
                  ? "Verify code"
                  : "Send WhatsApp code"
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
            </Button>
            {mode === "otp" && otpSentTo ? (
              <button
                type="button"
                className="w-full text-center text-xs font-semibold text-[var(--forest)]"
                disabled={loading}
                onClick={() => void handleOtpStart()}
              >
                Resend code
              </button>
            ) : null}
          </form>
          <p className="mt-4 text-center text-xs text-[var(--ink-soft)]">
            Need help signing in? Contact {orgName} sales.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center text-sm">Loading…</div>}>
      <LoginForm />
    </Suspense>
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
        className="min-h-[var(--touch-min)] rounded-[var(--radius-md)] border-[var(--line)] focus-visible:ring-[var(--forest)]"
      />
    </div>
  );
}
