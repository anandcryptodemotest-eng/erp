"use client";

import Link from "next/link";
import { Container, SectionHeader } from "@erp/ui";
import { useTenantDisplayName } from "@/components/TenantBrandingProvider";

export default function ProfileSupportPage() {
  const orgName = useTenantDisplayName();
  return (
    <Container layout="wide" className="pb-28 pt-5">
      <Link href="/profile" className="text-sm font-semibold text-[var(--forest)]">
        ← Profile
      </Link>
      <SectionHeader title="Support" className="mt-2" />
      <div className="mt-4 space-y-3 rounded-lg border border-[#e8e8e8] bg-white px-4 py-5 text-sm">
        <p className="text-[var(--ink)]">
          For order or delivery help, contact your {orgName} sales desk with your request number
          (SREQ-…).
        </p>
        <p className="text-[var(--ink-soft)]">
          You can also track status under{" "}
          <Link href="/orders" className="font-semibold text-[var(--forest)] underline">
            My orders
          </Link>
          .
        </p>
      </div>
    </Container>
  );
}
