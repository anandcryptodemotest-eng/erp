"use client";

import { Shell } from "@/components/Shell";

export default function SettingsPage() {
  return (
    <Shell>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-8 max-w-xl space-y-2">
        <h2 className="text-xl font-semibold">Platform Settings</h2>
        <p className="text-sm text-[var(--muted)]">
          Coming soon — global config (maintenance mode, default plan/timezone, registration policy)
          will live at <code className="font-mono text-xs">/api/platform/config</code>.
        </p>
      </div>
    </Shell>
  );
}
