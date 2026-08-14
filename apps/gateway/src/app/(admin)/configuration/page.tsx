"use client";

import Link from "next/link";
import { buttonVariants, PageScaffold, StatusChip } from "@erp/ui";

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
    href: "/configuration/documents",
    title: "Documents",
    description: "Print templates (placement canvas) for invoices and other artifacts.",
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
    <PageScaffold
      className="space-y-6"
      hero={{
        eyebrow: "Process owner",
        title: "Process Studio",
        description: "Workflows, forms, and process assets. Organisation settings live under Administration.",
        actions: (
          <Link href="/administration" className={buttonVariants({ variant: "secondary" })}>
            Administration
          </Link>
        ),
      }}
      ahead={
        <>
          <p className="mb-2 text-sm text-[var(--ink-soft)]">
            Owned by the <strong className="font-semibold text-[var(--ink)]">Process Owner</strong>.
          </p>
          <p className="text-xs text-[var(--ink-soft)]">
            Lifecycle: Draft → Validate → Publish → Snapshot → Execute. Runtime never sees drafts.
          </p>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STUDIO_ITEMS.map((item) =>
          item.status === "live" ? (
            <Link
              key={item.title}
              href={item.href}
              className="rounded-xl border border-[color-mix(in_srgb,var(--success)_35%,var(--line))] bg-white p-4 shadow-sm transition hover:border-[color-mix(in_srgb,var(--success)_55%,var(--line))] hover:shadow"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[var(--ink)]">{item.title}</h2>
                <StatusChip tone="success">Live</StatusChip>
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
                <StatusChip tone="neutral">Coming soon</StatusChip>
              </div>
              <p className="mt-1 text-xs text-[var(--ink-soft)]">{item.description}</p>
            </div>
          )
        )}
      </div>
    </PageScaffold>
  );
}
