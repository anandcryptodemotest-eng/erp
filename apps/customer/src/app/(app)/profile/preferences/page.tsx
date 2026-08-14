"use client";

import Link from "next/link";
import { Container, SectionHeader } from "@erp/ui";

export default function ProfilePreferencesPage() {
  return (
    <Container layout="wide" className="pb-28 pt-5">
      <Link href="/profile" className="text-sm font-semibold text-[var(--forest)]">
        ← Profile
      </Link>
      <SectionHeader title="Preferences" className="mt-2" />
      <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-5 text-sm text-[var(--ink-soft)]">
        Notification and language preferences will appear here. Defaults follow your organisation settings.
      </div>
    </Container>
  );
}
