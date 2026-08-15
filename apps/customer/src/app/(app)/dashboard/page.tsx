"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Customer portal dashboard retired — send buyers to Orders. */
export default function CustomerDashboardRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/orders");
  }, [router]);
  return (
    <div className="p-8 text-sm text-[var(--ink-soft,#666)]">Redirecting to orders…</div>
  );
}
