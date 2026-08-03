"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  AdminShell,
  Activity,
  Building2,
  GitBranch,
  LayoutDashboard,
  ScrollText,
  Server,
  Settings,
} from "@erp/ui";
import { clearPlatformAuth, getOperator } from "@/lib/api";

function formatRole(role?: string) {
  if (!role) return undefined;
  return role
    .replace(/^PLATFORM_/, "")
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

const NAV_GROUPS = [
  {
    key: "platform",
    title: "Platform",
    items: [
      { href: "/", label: "Dashboard", icon: <LayoutDashboard /> },
      { href: "/tenants", label: "Tenants", icon: <Building2 /> },
      { href: "/process", label: "Process Studio", icon: <GitBranch /> },
      { href: "/services", label: "Services", icon: <Activity /> },
    ],
  },
  {
    key: "system",
    title: "System",
    items: [
      { href: "/infrastructure", label: "Infrastructure", icon: <Server />, soon: true },
      { href: "/audit", label: "Audit Logs", icon: <ScrollText /> },
      { href: "/settings", label: "Settings", icon: <Settings />, soon: true },
    ],
  },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  /** Avoid SSR/client mismatch — localStorage only after mount */
  const [op, setOp] = useState<ReturnType<typeof getOperator>>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOp(getOperator());
    setReady(true);
  }, []);

  return (
    <AdminShell
      brandEyebrow="TrustWood"
      brandTitle="Platform Admin"
      brandContext={ready ? formatRole(op?.role) : undefined}
      groups={NAV_GROUPS}
      pathname={pathname}
      LinkComponent={({ href, children: c, className, title }) => (
        <Link href={href} className={className} title={title}>
          {c}
        </Link>
      )}
      user={{
        name: ready ? (op?.email ?? "Operator") : "Operator",
        subtitle: ready ? formatRole(op?.role) : undefined,
        onSignOut: () => {
          clearPlatformAuth();
          router.push("/login");
        },
      }}
      defaultOpenGroups={{ platform: true, system: true }}
    >
      <div className="p-6 md:p-8">{children}</div>
    </AdminShell>
  );
}
