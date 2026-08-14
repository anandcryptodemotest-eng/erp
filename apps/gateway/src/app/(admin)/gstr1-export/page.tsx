"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/admin-api";
import { Button, Input, PageScaffold } from "@erp/ui";

type ExportPayload = {
  period: { from: string; to: string };
  disclaimer: string;
  b2b: unknown[];
  b2c: unknown[];
  hsn: unknown[];
  count: number;
};

export default function Gstr1ExportPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<ExportPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api(`/api/invoices/gstr1-export?from=${from}&to=${to}&format=json`);
      setData(r.data as ExportPayload);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }, [from, to]);

  function downloadCsv() {
    window.open(`/api/invoices/gstr1-export?from=${from}&to=${to}&format=csv`, "_blank");
  }

  return (
    <PageScaffold
      className="space-y-6"
      hero={{
        eyebrow: "Accounting",
        title: "GSTR-1 export",
        description: "Download issued tax invoices for your CA / Tally / ClearTax. Sankalp does not file returns on GSTN.",
      }}
    >
      {error && (
        <div className="rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--danger)_35%,var(--line))] bg-[color-mix(in_srgb,var(--danger)_10%,white)] px-4 py-2.5 text-sm text-[var(--danger)]">{error}</div>
      )}

      <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm space-y-4 max-w-xl">
        <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <div className="flex gap-2">
          <Button disabled={busy} onClick={() => void load()}>
            {busy ? "Loading…" : "Preview"}
          </Button>
          <Button variant="secondary" onClick={downloadCsv}>
            Download CSV
          </Button>
        </div>
      </div>

      {data && (
        <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm space-y-3 text-sm">
          <p className="text-[var(--ink-soft)]">{data.disclaimer}</p>
          <p>
            Period {data.period.from} → {data.period.to} · {data.count} invoices · B2B{" "}
            {data.b2b.length} · B2C {data.b2c.length} · HSN rows {data.hsn.length}
          </p>
          <pre className="max-h-96 overflow-auto rounded-lg bg-[var(--mist)] p-3 text-xs">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </PageScaffold>
  );
}
