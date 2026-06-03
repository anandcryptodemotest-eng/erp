"use client";
import Link from "next/link";

interface LeadToCashGuideProps {
  current: FlowStepKey;
}

type FlowStepKey = "leads" | "opportunities" | "quotes" | "orders" | "invoices";

const STEPS: Array<{ key: FlowStepKey; label: string; hint: string; href: string }> = [
  { key: "leads", label: "Lead", hint: "Capture and qualify", href: "/leads" },
  { key: "opportunities", label: "Opportunity", hint: "Manage deal stage", href: "/opportunities" },
  { key: "quotes", label: "Quote", hint: "Send and accept", href: "/quotes" },
  { key: "orders", label: "Order", hint: "Confirm and ship", href: "/orders" },
  { key: "invoices", label: "Invoice", hint: "Collect payment", href: "/invoices" },
];

export default function LeadToCashGuide({ current }: LeadToCashGuideProps) {
  const currentIndex = Math.max(0, STEPS.findIndex((s) => s.key === current));

  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Lead-to-Cash Guide</h2>
          <p className="text-xs text-slate-500">Follow this sequence for Phase 1 E2E validation</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
          Step {currentIndex + 1} of {STEPS.length}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
        {STEPS.map((step, idx) => {
          const done = idx < currentIndex;
          const active = idx === currentIndex;
          return (
            <Link
              key={step.key}
              href={step.href}
              className={`rounded-lg border px-3 py-2 transition ${
                active
                  ? "border-emerald-300 bg-emerald-50"
                  : done
                    ? "border-sky-200 bg-sky-50 hover:bg-sky-100"
                    : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                    active
                      ? "bg-emerald-600 text-white"
                      : done
                        ? "bg-sky-600 text-white"
                        : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {idx + 1}
                </span>
                <span className="text-xs font-semibold text-slate-800">{step.label}</span>
              </div>
              <p className="text-[11px] text-slate-500">{step.hint}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
