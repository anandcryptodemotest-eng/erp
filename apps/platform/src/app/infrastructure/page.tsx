"use client";

import { Shell } from "@/components/Shell";

export default function InfrastructurePage() {
  return (
    <Shell>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-8 max-w-xl space-y-2">
        <h2 className="text-xl font-semibold">Infrastructure</h2>
        <p className="text-sm text-[var(--muted)]">
          Coming soon — Docker, Kubernetes, and other providers will plug in here without changing
          the health aggregator (registry-driven probes remain the source of truth for service status).
        </p>
      </div>
    </Shell>
  );
}
