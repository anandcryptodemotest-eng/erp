"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormDefinition } from "@erp/workflow";
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

  if (loading) return <div className="flex items-center justify-center py-16 text-gray-400">Loading…</div>;

  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="pb-4">
      <div className="bg-slate-900 px-4 py-6 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-3xl">👤</div>
          <div>
            <div className="text-lg font-bold">{customer?.name ?? "Guest"}</div>
            <div className="text-sm opacity-80">{customer?.phone || customer?.email}</div>
          </div>
        </div>
      </div>

      <div className="flex border-b border-gray-200">
        {(["info", "addresses", "notifications"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium capitalize ${
              tab === t ? "text-slate-900 border-b-2 border-slate-900" : "text-gray-500"
            }`}
          >
            {t === "notifications" ? `Inbox${unread > 0 ? ` (${unread})` : ""}` : t}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <div className="px-4 py-4 space-y-4">
          {msg && <div className="text-sm text-red-600">{msg}</div>}
          {customer && profileScreen ? (
            <>
              {customer.customerGroup && (
                <p className="text-xs text-gray-500">
                  Group: <span className="font-medium text-gray-800">{customer.customerGroup}</span>
                </p>
              )}
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
            <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              No customer profile linked. Contact your supplier to invite you, or register again.
            </div>
          )}
          <button
            type="button"
            onClick={signOut}
            className="w-full rounded-full border border-red-200 py-3 text-sm font-semibold text-red-600"
          >
            Sign Out
          </button>
        </div>
      )}

      {tab === "addresses" && customer && (
        <div className="px-4 py-4">
          {msg && <div className="mb-3 text-sm text-red-600">{msg}</div>}
          <div className="mb-4 space-y-2">
            {addresses.map((a) => (
              <div key={a.id} className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800">{a.label}</span>
                  {a.isDefault && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      Default
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {a.line1}, {a.city}
                  {a.state ? `, ${a.state}` : ""} – {a.pincode}
                </div>
                <div className="mt-3 flex gap-3 text-xs font-semibold">
                  {!a.isDefault && (
                    <button type="button" className="text-slate-700" onClick={() => void setDefault(a)}>
                      Set default
                    </button>
                  )}
                  <button type="button" className="text-slate-700" onClick={() => openEditAddress(a)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-red-600"
                    onClick={() => void deleteAddress(a.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {!showAddressForm && (
            <button
              type="button"
              onClick={openCreateAddress}
              className="w-full rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-medium text-slate-700"
            >
              + Add New Address
            </button>
          )}

          {showAddressForm && addressScreen && (
            <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-700">
                  {addressMode === "edit" ? "Edit Address" : "New Address"}
                </div>
                <button
                  type="button"
                  className="text-xs font-medium text-gray-600"
                  onClick={() => {
                    setShowAddressForm(false);
                    setEditingId(null);
                  }}
                >
                  Cancel
                </button>
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
          )}
        </div>
      )}

      {tab === "notifications" && (
        <div className="px-4 py-4">
          {unread > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="mb-3 text-xs font-semibold text-slate-700 underline"
            >
              Mark all as read
            </button>
          )}
          {notifications.length === 0 && (
            <div className="flex flex-col items-center py-10 text-gray-400">
              <div className="text-4xl">🔔</div>
              <div className="mt-2 text-sm">No notifications</div>
            </div>
          )}
          <div className="space-y-2">
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => void markRead(n)}
                className={`w-full rounded-xl p-4 text-left ${
                  n.isRead ? "bg-gray-50" : "border border-sky-100 bg-sky-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  {!n.isRead && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-sky-500" />}
                  <span className="text-sm font-semibold text-gray-900">{n.title}</span>
                  <span className="ml-auto text-xs text-gray-400">
                    {new Date(n.createdAt).toLocaleDateString("en-IN")}
                  </span>
                </div>
                <p className="mt-1 pl-4 text-sm text-gray-600">{n.body}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
