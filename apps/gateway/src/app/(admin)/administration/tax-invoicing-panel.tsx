"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input } from "@erp/ui";
import { api, getTenantId } from "@/lib/admin-api";

const INDIAN_STATES: { code: string; name: string }[] = [
  { code: "01", name: "Jammu & Kashmir" },
  { code: "07", name: "Delhi" },
  { code: "29", name: "Karnataka" },
  { code: "27", name: "Maharashtra" },
  { code: "33", name: "Tamil Nadu" },
  { code: "36", name: "Telangana" },
];

export function TaxInvoicingPanel() {
  const tenantId = typeof window !== "undefined" ? getTenantId() : "";
  const [regime, setRegime] = useState("NONE");
  const [scheme, setScheme] = useState("UNREGISTERED");
  const [gstin, setGstin] = useState("");
  const [legalName, setLegalName] = useState("");
  const [address, setAddress] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [posDefault, setPosDefault] = useState("");
  const [eInvoiceMode, setEInvoiceMode] = useState("OFF");
  const [nicMode, setNicMode] = useState("DEMO");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      const r = await api(`/api/tenants/${tenantId}/settings`);
      const s = (r.data ?? {}) as Record<string, string>;
      setRegime(s["tax.regime"] ?? "NONE");
      setScheme(s["tax.scheme"] ?? "UNREGISTERED");
      setGstin(s["tax.gstin"] ?? "");
      setLegalName(s["tax.legalName"] ?? "");
      setAddress(s["tax.address"] ?? "");
      setStateCode(s["tax.stateCode"] ?? "");
      setPosDefault(s["tax.placeOfSupplyDefault"] ?? "");
      setEInvoiceMode(s["tax.eInvoiceMode"] ?? "OFF");
      setNicMode(s["tax.nic.mode"] === "PRODUCTION" ? "PRODUCTION" : "DEMO");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load tax settings");
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (regime === "NONE") setScheme("UNREGISTERED");
    else if (scheme === "UNREGISTERED") setScheme("REGULAR");
  }, [regime, scheme]);

  async function save() {
    if (!tenantId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const payload: Record<string, string> = {
        "tax.regime": regime,
        "tax.scheme": regime === "NONE" ? "UNREGISTERED" : scheme,
        "tax.eInvoiceMode": regime === "NONE" ? "OFF" : eInvoiceMode,
        "tax.nic.mode": regime === "NONE" ? "DEMO" : nicMode,
      };
      if (regime === "IN_GST") {
        payload["tax.gstin"] = gstin.trim().toUpperCase();
        payload["tax.legalName"] = legalName.trim();
        payload["tax.address"] = address.trim();
        payload["tax.stateCode"] = stateCode;
        if (posDefault) payload["tax.placeOfSupplyDefault"] = posDefault;
      }
      await api(`/api/tenants/${tenantId}/settings`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setMessage("Tax & invoicing settings saved");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-[var(--ink)]">Tax &amp; invoicing</h2>
        <p className="mt-1 text-xs text-[var(--ink-soft)]">
          OMS is universal; GST is a tenant tax pack. Non-GST shops issue a simple Bill. GST-registered
          tenants get Tax Invoice / Bill of Supply automatically.
        </p>
      </div>
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}

      <label className="block text-xs text-[var(--ink-soft)]">
        Tax regime
        <select
          className="mt-0.5 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
          value={regime}
          onChange={(e) => setRegime(e.target.value)}
        >
          <option value="NONE">No GST — simple Bill</option>
          <option value="IN_GST">India GST</option>
        </select>
      </label>

      {regime === "IN_GST" && (
        <>
          <label className="block text-xs text-[var(--ink-soft)]">
            GST scheme
            <select
              className="mt-0.5 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
              value={scheme}
              onChange={(e) => setScheme(e.target.value)}
            >
              <option value="REGULAR">Regular</option>
              <option value="COMPOSITION">Composition</option>
            </select>
          </label>
          <Input label="Seller GSTIN" value={gstin} onChange={(e) => setGstin(e.target.value)} />
          <Input label="Legal name" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
          <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
          <label className="block text-xs text-[var(--ink-soft)]">
            Seller state
            <select
              className="mt-0.5 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value)}
            >
              <option value="">Select state</option>
              {INDIAN_STATES.map((st) => (
                <option key={st.code} value={st.code}>
                  {st.name} ({st.code})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-[var(--ink-soft)]">
            Default place of supply (fallback only)
            <select
              className="mt-0.5 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
              value={posDefault}
              onChange={(e) => setPosDefault(e.target.value)}
            >
              <option value="">None — must set per transaction</option>
              {INDIAN_STATES.map((st) => (
                <option key={st.code} value={st.code}>
                  {st.name} ({st.code})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-[var(--ink-soft)]">
            E-invoice mode (product setting)
            <select
              className="mt-0.5 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
              value={eInvoiceMode}
              onChange={(e) => setEInvoiceMode(e.target.value)}
            >
              <option value="OFF">Off — no IRN integration</option>
              <option value="OPTIONAL">Optional — manual Generate IRN</option>
              <option value="REQUIRED">Required — block Bill until IRN for applicable B2B</option>
            </select>
          </label>
          <label className="block text-xs text-[var(--ink-soft)]">
            NIC / IRP environment
            <select
              className="mt-0.5 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
              value={nicMode}
              onChange={(e) => setNicMode(e.target.value)}
            >
              <option value="DEMO">Demo — stub IRN / e-way (safe for trials)</option>
              <option value="PRODUCTION">Production — real NIC (needs credentials; not live yet)</option>
            </select>
          </label>
          <p className="text-[11px] text-[var(--ink-soft)]">
            Keep Demo until NIC credentials are issued. Production mode is reserved for live IRP and will
            reject stub IRNs.
          </p>
        </>
      )}

      <Button disabled={busy} onClick={() => void save()}>
        {busy ? "Saving…" : "Save tax settings"}
      </Button>
    </div>
  );
}
