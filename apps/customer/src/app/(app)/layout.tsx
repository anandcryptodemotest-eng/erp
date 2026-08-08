"use client";

import { PortalShell } from "@/components/PortalShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
