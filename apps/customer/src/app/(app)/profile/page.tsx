"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Container, Skeleton } from "@erp/ui";
import {
  HelpCard,
  MenuList,
  ProfileHeader,
  RecentOrders,
} from "@/components/profile/ProfileBits";
import { api, clearAuth, isAuthenticated } from "@/lib/api-client";
import { ensureCustomerProfile } from "@/lib/ensure-customer-profile";
import { displayRequestStatus, omsLabel, sreqLabel } from "@/lib/oms-status";

interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}

interface SalesRequestRow {
  id: string;
  requestNumber: string;
  status: string;
  salesOrder?: { status: string } | null;
}

interface Notification {
  id: string;
  isRead: boolean;
}

export default function ProfileHubPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<SalesRequestRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState("");

  const load = useCallback(async () => {
    if (!isAuthenticated()) {
      setLoading(false);
      return;
    }
    const [custEnsure, orderRes, notifRes] = await Promise.all([
      ensureCustomerProfile(),
      api<{ data: SalesRequestRow[] }>("sales", "/api/sales-requests?limit=5"),
      api<{ data: Notification[] }>("gateway", "/api/notifications?limit=20"),
    ]);
    if (custEnsure.customer) {
      setCustomer(custEnsure.customer as Customer);
      setProfileError("");
      try {
        if (custEnsure.customer.name) {
          localStorage.setItem("customer_display_name", String(custEnsure.customer.name));
        }
      } catch {
        /* ignore */
      }
    } else {
      setProfileError(
        custEnsure.error?.includes("portal") || custEnsure.error?.includes("Only portal")
          ? "This login is not a customer account. Sign in with a customer email."
          : custEnsure.error || "Could not load profile"
      );
    }
    if (!orderRes.error) setOrders(orderRes.data?.data ?? []);
    if (!notifRes.error) {
      setUnread((notifRes.data?.data ?? []).filter((n) => !n.isRead).length);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isAuthenticated() && !loading) {
    return (
      <Container layout="wide" className="space-y-4 py-8">
        <ProfileHeader name="Guest" />
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-6 text-center">
          <p className="text-sm text-[var(--ink-soft)]">Sign in to manage orders and addresses.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button
              variant="primary"
              className="!rounded-md"
              onClick={() => router.push("/login?returnTo=/profile")}
            >
              Sign in
            </Button>
            <Button
              variant="outline"
              className="!rounded-md"
              onClick={() => router.push("/login?returnTo=/profile")}
            >
              Register
            </Button>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container layout="wide" className="space-y-4 pb-28 pt-4 md:pb-10">
      {loading ? (
        <>
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </>
      ) : profileError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-950">
          <p className="font-semibold">{profileError}</p>
          <Button
            className="mt-4 !rounded-md"
            variant="primary"
            size="sm"
            onClick={() => {
              clearAuth();
              router.push("/login?returnTo=/profile");
            }}
          >
            Sign in as customer
          </Button>
        </div>
      ) : (
        <>
          <ProfileHeader
            name={customer?.name || "Customer"}
            phone={customer?.phone}
            email={customer?.email}
          />

          <RecentOrders
            orders={orders.slice(0, 5).map((o) => {
              const st = displayRequestStatus(o);
              return {
                id: o.id,
                requestNumber: o.requestNumber,
                statusLabel: omsLabel(st) !== st ? omsLabel(st) : sreqLabel(st),
                href: `/orders/${o.id}?type=sreq`,
              };
            })}
          />

          <MenuList
            items={[
              { href: "/dashboard", label: "My dashboard" },
              { href: "/orders", label: "My orders" },
              { href: "/profile/addresses", label: "Addresses" },
              {
                href: "/profile/notifications",
                label: "Notifications",
                meta: unread ? `${unread} new` : undefined,
              },
              { href: "/profile/preferences", label: "Preferences" },
              { href: "/profile/security", label: "Password & security" },
              { href: "/profile/support", label: "Support" },
              { href: "/profile/details", label: "Personal details" },
            ]}
          />

          <HelpCard />

          <Button
            variant="outline"
            size="block"
            className="!rounded-md"
            onClick={() => {
              clearAuth();
              router.replace("/login");
            }}
          >
            Sign out
          </Button>
        </>
      )}
    </Container>
  );
}
