"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Container, SectionHeader } from "@erp/ui";
import { api } from "@/lib/api-client";

export default function ProfileSecurityPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const fieldCls =
    "mt-0.5 w-full rounded-md border border-[#e8e8e8] px-3 py-2.5 text-sm outline-none focus:border-[var(--forest-mid)]";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    // Proxied to the gateway by next.config rewrites (/api/* → gateway).
    const res = await api("gateway", "/api/auth?action=set-password", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    setSaving(false);
    if (res.error) setError(res.error);
    else {
      setMsg("Password updated. You will need to sign in again on other devices.");
      setPassword("");
      setConfirm("");
    }
  }

  return (
    <Container layout="wide" className="pb-28 pt-5">
      <Link href="/profile" className="text-sm font-semibold text-[var(--forest)]">
        ← Profile
      </Link>
      <SectionHeader title="Password & security" className="mt-2" />
      <p className="mt-1 max-w-md text-sm text-[var(--ink-soft)]">
        Set a password to sign in with your email and password in addition to Google. This also
        applies to accounts created with Google.
      </p>
      <form onSubmit={onSubmit} className="mt-4 max-w-md space-y-3 rounded-lg border border-[#e8e8e8] bg-white p-4">
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        {msg ? <p className="text-sm font-semibold text-[var(--forest)]">{msg}</p> : null}
        <label className="block text-xs font-semibold text-[var(--ink-soft)]">
          Password *
          <input
            type="password"
            className={fieldCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        <label className="block text-xs font-semibold text-[var(--ink-soft)]">
          Confirm password *
          <input
            type="password"
            className={fieldCls}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
          />
        </label>
        <Button type="submit" variant="primary" className="!rounded-md" loading={saving} disabled={saving}>
          Update password
        </Button>
      </form>
    </Container>
  );
}
