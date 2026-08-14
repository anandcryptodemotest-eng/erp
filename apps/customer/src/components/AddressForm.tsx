"use client";

import { useState } from "react";
import { Button } from "@erp/ui";
import { api } from "@/lib/api-client";

export type AddressDraft = {
  label: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
};

export type SavedAddress = {
  id: string;
  label: string;
  line1: string;
  city: string;
  state?: string | null;
  pincode: string;
  isDefault: boolean;
};

const INITIAL: AddressDraft = {
  label: "Site",
  line1: "",
  city: "",
  state: "",
  pincode: "",
  isDefault: true,
};

/**
 * Direct address form (no screen-runtime dependency) — reliable for portal save.
 */
export function AddressForm({
  customerId,
  initial,
  onSaved,
  onCancel,
}: {
  customerId: string;
  initial?: Partial<AddressDraft>;
  onSaved: (address: SavedAddress) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<AddressDraft>({ ...INITIAL, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof AddressDraft>(key: K, value: AddressDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!customerId) {
      setError("Customer profile required — sign in again");
      return;
    }
    if (!draft.line1.trim() || !draft.city.trim() || !draft.pincode.trim()) {
      setError("Street, city and pincode are required");
      return;
    }

    setSaving(true);
    const res = await api<{ data: SavedAddress }>(
      "sales",
      `/api/customers/${customerId}/addresses`,
      {
        method: "POST",
        body: JSON.stringify({
          label: draft.label.trim() || "Site",
          line1: draft.line1.trim(),
          city: draft.city.trim(),
          state: draft.state.trim() || undefined,
          pincode: draft.pincode.trim(),
          isDefault: draft.isDefault,
        }),
      }
    );
    setSaving(false);

    if (res.error || !res.data?.data?.id) {
      setError(res.error || "Could not save address");
      return;
    }
    await onSaved(res.data.data);
    setDraft({ ...INITIAL, isDefault: false });
  }

  const fieldCls =
    "mt-0.5 w-full rounded-md border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--forest-mid)] focus:ring-2 focus:ring-[var(--forest)]/20";

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
      ) : null}

      <label className="block text-xs font-semibold text-[var(--ink-soft)]">
        Label *
        <input
          className={fieldCls}
          value={draft.label}
          onChange={(e) => set("label", e.target.value)}
          placeholder="Home / Site / Office"
          required
        />
      </label>

      <label className="block text-xs font-semibold text-[var(--ink-soft)]">
        Street / building *
        <input
          className={fieldCls}
          value={draft.line1}
          onChange={(e) => set("line1", e.target.value)}
          placeholder="Plot / street / landmark"
          required
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-semibold text-[var(--ink-soft)]">
          City *
          <input
            className={fieldCls}
            value={draft.city}
            onChange={(e) => set("city", e.target.value)}
            required
          />
        </label>
        <label className="block text-xs font-semibold text-[var(--ink-soft)]">
          State
          <input
            className={fieldCls}
            value={draft.state}
            onChange={(e) => set("state", e.target.value)}
          />
        </label>
      </div>

      <label className="block text-xs font-semibold text-[var(--ink-soft)]">
        Pincode *
        <input
          className={fieldCls}
          value={draft.pincode}
          onChange={(e) => set("pincode", e.target.value)}
          inputMode="numeric"
          required
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-[#cfd5d1]"
          checked={draft.isDefault}
          onChange={(e) => set("isDefault", e.target.checked)}
        />
        Set as default delivery address
      </label>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="submit" variant="primary" className="!rounded-md" loading={saving} disabled={saving}>
          {saving ? "Saving…" : "Save address"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" className="!rounded-md" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
