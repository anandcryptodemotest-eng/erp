"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormDefinition } from "@erp/workflow";
import { Button, Chip, ChipGroup, Container, SectionHeader, Skeleton } from "@erp/ui";
import { api, clearAuth } from "@/lib/api-client";
import {
  CustomerScreenController,
  createCustomerHost,
} from "@/lib/ui-host/CustomerScreenController";

interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  wallet?: number;
  customerGroup?: string | null;
}
interface Address {
  id: string;
  label: string;
  line1: string;
  city: string;
  state?: string | null;
  pincode: string;
  isDefault: boolean;
}
interface Notification {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

async function loadPublishedForm(formId: string): Promise<FormDefinition | null> {
  const r = await api<{ data: { definition: FormDefinition } }>(
    "sales",
    `/api/workflow-forms/published?formId=${encodeURIComponent(formId)}&audience=CUSTOMER`
  );
  return r.data?.data?.definition ?? null;
}

export default function ProfilePage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [tab, setTab] = useState<"info" | "addresses" | "notifications">("info");
  const [loading, setLoading] = useState(true);
  const [profileScreen, setProfileScreen] = useState<FormDefinition | null>(null);
  const [addressScreen, setAddressScreen] = useState<FormDefinition | null>(null);
  const [profileFields, setProfileFields] = useState<Record<string, string>>({});
  const [addressFields, setAddressFields] = useState<Record<string, string>>({});
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressMode, setAddressMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const [custRes, notifRes, profileForm, addressForm] = await Promise.all([
      api<{ data: Customer & { addresses?: Address[] } }>("sales", "/api/customers/me"),
      api<{ data: Notification[] }>("gateway", "/api/notifications?limit=30"),
      loadPublishedForm("customer-profile"),
      loadPublishedForm("customer-address"),
    ]);
    if (!custRes.error && custRes.data?.data) {
      const cust = custRes.data.data;
      setCustomer(cust);
      setAddresses(cust.addresses ?? []);
      setProfileFields({
        name: cust.name ?? "",
        phone: cust.phone ?? "",
        email: cust.email ?? "",
      });
    }
    if (!notifRes.error) setNotifications(notifRes.data?.data ?? []);
    setProfileScreen(profileForm);
    setAddressScreen(addressForm);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function refreshAddresses() {
    if (!customer) return;
    const addrRes = await api<{ data: Address[] }>("sales", `/api/customers/${customer.id}/addresses`);
    if (!addrRes.error && addrRes.data?.data) setAddresses(addrRes.data.data);
  }

  function openCreateAddress() {
    setAddressMode("create");
    setEditingId(null);
    setAddressFields({
      label: "Site",
      line1: "",
      city: "",
      state: "",
      pincode: "",
      isDefault: "false",
    });
    setShowAddressForm(true);
    setMsg("");
  }

  function openEditAddress(a: Address) {
    setAddressMode("edit");
    setEditingId(a.id);
    setAddressFields({
      label: a.label,
      line1: a.line1,
      city: a.city,
      state: a.state ?? "",
      pincode: a.pincode,
      isDefault: a.isDefault ? "true" : "false",
    });
    setShowAddressForm(true);
    setMsg("");
  }

  async function deleteAddress(addrId: string) {
    if (!customer) return;
    if (!confirm("Remove this address?")) return;
    const res = await api("sales", `/api/customers/${customer.id}/addresses/${addrId}`, {
      method: "DELETE",
    });
    if (res.error) {
      setMsg(res.error);
      return;
    }
    await refreshAddresses();
  }

  async function setDefault(addr: Address) {
    if (!customer) return;
    await api("sales", `/api/customers/${customer.id}/addresses/${addr.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isDefault: true }),
    });
    await refreshAddresses();
  }

  async function markRead(n: Notification) {
    if (n.isRead) return;
    await api("gateway", `/api/notifications/${n.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isRead: true }),
    });
    setNotifications((list) => list.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
  }

  async function markAllRead() {
    await api("gateway", "/api/notifications", {
      method: "PATCH",
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications((list) => list.map((x) => ({ ...x, isRead: true })));
  }

  function signOut() {
    clearAuth();
    router.replace("/login");
  }

  const host = useMemo(
    () =>
      createCustomerHost({
        permissions: { canEdit: true, canComplete: !saving, roles: ["CUSTOMER"] },
        navigation: { push: (p) => router.push(p) },
      }),
    [router, saving]
  );

  const unread = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <Container layout="wide" className="space-y-4 py-10">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-48 w-full" />
      </Container>
    );
  }

  return (
    <Container layout="wide" className="pb-28 pt-5">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--forest)] font-display text-xl font-bold text-white">
          {(customer?.name ?? "G").slice(0, 1).toUpperCase()}
        </div>
        <div>
          <SectionHeader title={customer?.name ?? "Guest"} className="mb-0" />
          <p className="text-sm text-[var(--ink-soft)]">{customer?.phone || customer?.email}</p>
        </div>
      </div>

      <ChipGroup className="mb-6">
        <Chip active={tab === "info"} onClick={() => setTab("info")}>
          Info
        </Chip>
        <Chip active={tab === "addresses"} onClick={() => setTab("addresses")}>
          Addresses
        </Chip>
        <Chip active={tab === "notifications"} onClick={() => setTab("notifications")}>
          Inbox{unread > 0 ? ` (${unread})` : ""}
        </Chip>
      </ChipGroup>

      {tab === "info" ? (
        <div className="space-y-4">
          {msg ? <div className="text-sm text-[var(--danger)]">{msg}</div> : null}
          {customer && profileScreen ? (
            <>
              {customer.customerGroup ? (
                <p className="text-xs text-[var(--ink-soft)]">
                  Group: <span className="font-medium text-[var(--ink)]">{customer.customerGroup}</span>
                </p>
              ) : null}
              <CustomerScreenController
                host={host}
                screen={profileScreen}
                customer={{ id: customer.id, name: customer.name }}
                fieldValues={profileFields}
                setFieldValue={(key, value) =>
                  setProfileFields((prev) => ({ ...prev, [key]: value }))
                }
                busy={saving}
                submitContext={{
                  customerId: customer.id,
                  onBusy: setSaving,
                  onSuccess: async (result) => {
                    setMsg("Profile saved");
                    const data = (result as { data?: Customer } | undefined)?.data;
                    if (data) {
                      setCustomer((c) => (c ? { ...c, ...data } : data));
                      setProfileFields({
                        name: data.name ?? "",
                        phone: data.phone ?? "",
                        email: data.email ?? "",
                      });
                    } else {
                      await load();
                    }
                  },
                  onError: (m) => setMsg(m),
                }}
              />
            </>
          ) : (
            <div className="rounded-[var(--radius)] border border-[var(--amber)]/40 bg-[var(--paper)] p-4 text-sm text-[var(--ink)]">
              No customer profile linked. Contact your supplier to invite you, or register again.
            </div>
          )}
          <Button variant="outline" size="block" className="border-red-200 text-[var(--danger)]" onClick={signOut}>
            Sign out
          </Button>
        </div>
      ) : null}

      {tab === "addresses" && customer ? (
        <div>
          {msg ? <div className="mb-3 text-sm text-[var(--danger)]">{msg}</div> : null}
          <div className="mb-4 space-y-2">
            {addresses.map((a) => (
              <div
                key={a.id}
                className="rounded-[var(--radius)] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-sm)]"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--ink)]">{a.label}</span>
                  {a.isDefault ? (
                    <span className="rounded-[var(--radius-full)] bg-[var(--mist)] px-2 py-0.5 text-xs font-medium text-[var(--forest)]">
                      Default
                    </span>
                  ) : null}
                </div>
                <div className="text-sm text-[var(--ink-soft)]">
                  {a.line1}, {a.city}
                  {a.state ? `, ${a.state}` : ""} – {a.pincode}
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  {!a.isDefault ? (
                    <Button variant="link" size="sm" onClick={() => void setDefault(a)}>
                      Set default
                    </Button>
                  ) : null}
                  <Button variant="link" size="sm" onClick={() => openEditAddress(a)}>
                    Edit
                  </Button>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-[var(--danger)]"
                    onClick={() => void deleteAddress(a.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {!showAddressForm ? (
            <Button variant="outline" size="block" onClick={openCreateAddress}>
              + Add new address
            </Button>
          ) : null}

          {showAddressForm && addressScreen ? (
            <div className="mt-4 space-y-3 rounded-[var(--radius)] border border-[var(--line)] bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-[var(--ink)]">
                  {addressMode === "edit" ? "Edit address" : "New address"}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddressForm(false);
                    setEditingId(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
              <CustomerScreenController
                host={host}
                screen={{
                  ...addressScreen,
                  title: addressMode === "edit" ? "Edit address" : "New address",
                }}
                customer={{ id: customer.id, name: customer.name }}
                fieldValues={addressFields}
                setFieldValue={(key, value) =>
                  setAddressFields((prev) => ({ ...prev, [key]: value }))
                }
                busy={saving}
                submitContext={{
                  customerId: customer.id,
                  addressMode,
                  addressId: editingId,
                  onBusy: setSaving,
                  onSuccess: async () => {
                    setShowAddressForm(false);
                    setEditingId(null);
                    setMsg("");
                    await refreshAddresses();
                  },
                  onError: (m) => setMsg(m),
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "notifications" ? (
        <div>
          {unread > 0 ? (
            <Button variant="link" size="sm" className="mb-3" onClick={() => void markAllRead()}>
              Mark all as read
            </Button>
          ) : null}
          {notifications.length === 0 ? (
            <div className="rounded-[var(--radius)] border border-[var(--line)] bg-white px-6 py-12 text-center">
              <p className="font-display text-lg text-[var(--ink)]">No notifications</p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">Order updates will show up here.</p>
            </div>
          ) : null}
          <div className="space-y-2">
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => void markRead(n)}
                className={`w-full rounded-[var(--radius)] border p-4 text-left ${
                  n.isRead
                    ? "border-[var(--line)] bg-white"
                    : "border-[var(--forest)]/20 bg-[var(--mist)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  {!n.isRead ? (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--forest)]" />
                  ) : null}
                  <span className="text-sm font-semibold text-[var(--ink)]">{n.title}</span>
                  <span className="ml-auto text-xs text-[var(--ink-soft)]">
                    {new Date(n.createdAt).toLocaleDateString("en-IN")}
                  </span>
                </div>
                <p className="mt-1 pl-4 text-sm text-[var(--ink-soft)]">{n.body}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </Container>
  );
}
