"use client";

import Link from "next/link";
import { PageHeader } from "@erp/ui";

const STUDIO_ITEMS: {
  href: string;
  title: string;
  description: string;
  status: "live" | "soon";
}[] = [
  {
    href: "/workflows",
    title: "Workflows",
    description: "Design and publish order lifecycle graphs (Process Owner).",
    status: "live",
  },
  {
    href: "/configuration/forms",
    title: "Forms",
    description: "Versioned task screens referenced by workflows via AssetRef.",
    status: "live",
  },
  {
    href: "#",
    title: "Rules",
    description: "Approval and business rules.",
    status: "soon",
  },
  {
    href: "#",
    title: "Notifications",
    description: "Templates and channels for process events.",
    status: "soon",
  },
  {
    href: "#",
    title: "Numbering",
    description: "Document number sequences (SO, invoice, …).",
    status: "soon",
  },
  {
    href: "#",
    title: "Templates",
    description: "Starter packs and industry templates.",
    status: "soon",
  },
];

export default function ProcessStudioPage() {
  return (
    <div className="space-y-6 p-4 md:p-8">
      <div>
        <PageHeader title="Process Studio" />
        <p className="-mt-4 mb-2 text-sm text-[var(--ink-soft)]">
          Business configuration — workflows, forms, and related process assets. Owned by the{" "}
          <strong className="font-semibold text-[var(--ink-soft)]">Process Owner</strong>. Organisation
          settings live under{" "}
          <Link href="/administration" className="font-medium text-emerald-800 underline">
            Administration
          </Link>
          .
        </p>
        <p className="text-xs text-[var(--ink-soft)]">
          Lifecycle: Draft → Validate → Publish → Snapshot → Execute. Runtime never sees drafts.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STUDIO_ITEMS.map((item) =>
          item.status === "live" ? (
            <Link
              key={item.title}
              href={item.href}
              className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm transition hover:border-emerald-400 hover:shadow"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[var(--ink)]">{item.title}</h2>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                  Live
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--ink-soft)]">{item.description}</p>
            </Link>
          ) : (
            <div
              key={item.title}
              className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--mist)]/80 p-4 opacity-80"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[var(--ink-soft)]">{item.title}</h2>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
                  Coming soon
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--ink-soft)]">{item.description}</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
