"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearAuth } from "@/lib/api-client";

interface Customer { id: string; name: string; phone: string; email: string; wallet: number; customerGroup?: string }
interface Address { id: string; label: string; line1: string; city: string; state: string; pincode: string; isDefault: boolean }
interface Notification { id: string; title: string; body: string; isRead: boolean; createdAt: string }

export default function ProfilePage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [tab, setTab] = useState<"info" | "addresses" | "notifications">("info");
  const [loading, setLoading] = useState(true);

  // New address form
  const [showAddAddr, setShowAddAddr] = useState(false);
  const [addrForm, setAddrForm] = useState({ label: "Home", line1: "", city: "", state: "", pincode: "", isDefault: false });
  const [savingAddr, setSavingAddr] = useState(false);

  useEffect(() => {
    async function load() {
      const [custRes, notifRes] = await Promise.all([
        api<{ data: Customer[] }>("sales", "/api/customers?limit=1"),
        api<{ data: Notification[] }>("gateway", "/api/notifications?limit=20"),
      ]);
      if (!custRes.error && custRes.data.data.length > 0) {
        const cust = custRes.data.data[0];
        setCustomer(cust);
        const addrRes = await api<{ data: Address[] }>("sales", `/api/customers/${cust.id}/addresses`);
        if (!addrRes.error) setAddresses(addrRes.data.data);
      }
      if (!notifRes.error) setNotifications(notifRes.data.data);
      setLoading(false);
    }
    load();
  }, []);

  async function saveAddress() {
    if (!customer) return;
    setSavingAddr(true);
    const res = await api("sales", `/api/customers/${customer.id}/addresses`, {
      method: "POST",
      body: JSON.stringify(addrForm),
    });
    setSavingAddr(false);
    if (!res.error) {
      const addrRes = await api<{ data: Address[] }>("sales", `/api/customers/${customer.id}/addresses`);
      if (!addrRes.error) setAddresses(addrRes.data.data);
      setShowAddAddr(false);
      setAddrForm({ label: "Home", line1: "", city: "", state: "", pincode: "", isDefault: false });
    }
  }

  function signOut() {
    clearAuth();
    router.replace("/login");
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-gray-400">Loading…</div>;

  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="pb-4">
      {/* Profile header */}
      <div className="bg-green-600 px-4 py-6 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-3xl">
            👤
          </div>
          <div>
            <div className="text-lg font-bold">{customer?.name ?? "Guest"}</div>
            <div className="text-sm opacity-80">{customer?.phone}</div>
            {customer && <div className="text-sm opacity-70">Wallet: ₹{Number(customer.wallet).toLocaleString("en-IN")}</div>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(["info", "addresses", "notifications"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium capitalize transition-colors relative ${tab === t ? "text-green-600 border-b-2 border-green-600" : "text-gray-500"}`}>
            {t === "notifications" ? `Inbox${unread > 0 ? ` (${unread})` : ""}` : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Info tab */}
      {tab === "info" && customer && (
        <div className="px-4 py-4 space-y-4">
          <div className="rounded-xl border border-gray-100 bg-white divide-y divide-gray-100">
            {[
              { label: "Name", value: customer.name },
              { label: "Phone", value: customer.phone },
              { label: "Email", value: customer.email },
              { label: "Group", value: customer.customerGroup ?? "Regular" },
              { label: "Wallet Balance", value: `₹${Number(customer.wallet).toLocaleString("en-IN")}` },
            ].map((row) => (
              <div key={row.label} className="flex justify-between px-4 py-3 text-sm">
                <span className="text-gray-500">{row.label}</span>
                <span className="font-medium text-gray-900">{row.value}</span>
              </div>
            ))}
          </div>
          <button onClick={signOut}
            className="w-full rounded-full border border-red-200 py-3 text-sm font-semibold text-red-600 active:bg-red-50">
            Sign Out
          </button>
        </div>
      )}

      {/* Addresses tab */}
      {tab === "addresses" && (
        <div className="px-4 py-4">
          <div className="space-y-2 mb-4">
            {addresses.map((a) => (
              <div key={a.id} className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-800">{a.label}</span>
                  {a.isDefault && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 font-medium">Default</span>}
                </div>
                <div className="text-sm text-gray-500">{a.line1}, {a.city}, {a.state} – {a.pincode}</div>
              </div>
            ))}
          </div>

          {!showAddAddr && (
            <button onClick={() => setShowAddAddr(true)}
              className="w-full rounded-xl border-2 border-dashed border-green-300 py-3 text-sm font-medium text-green-600">
              + Add New Address
            </button>
          )}

          {showAddAddr && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
              <div className="text-sm font-semibold text-gray-700">New Address</div>
              {[
                { key: "label", placeholder: "Label (e.g. Home, Work)" },
                { key: "line1", placeholder: "Street / Flat / Building" },
                { key: "city", placeholder: "City" },
                { key: "state", placeholder: "State" },
                { key: "pincode", placeholder: "Pincode" },
              ].map(({ key, placeholder }) => (
                <input key={key} placeholder={placeholder}
                  value={addrForm[key as keyof typeof addrForm] as string}
                  onChange={(e) => setAddrForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-500" />
              ))}
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={addrForm.isDefault} onChange={(e) => setAddrForm((f) => ({ ...f, isDefault: e.target.checked }))} />
                Set as default
              </label>
              <div className="flex gap-2">
                <button onClick={saveAddress} disabled={savingAddr}
                  className="flex-1 rounded-full bg-green-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                  {savingAddr ? "Saving…" : "Save Address"}
                </button>
                <button onClick={() => setShowAddAddr(false)}
                  className="flex-1 rounded-full border border-gray-200 py-2.5 text-sm font-medium text-gray-600">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notifications tab */}
      {tab === "notifications" && (
        <div className="px-4 py-4">
          {notifications.length === 0 && (
            <div className="flex flex-col items-center py-10 text-gray-400">
              <div className="text-4xl">🔔</div>
              <div className="mt-2 text-sm">No notifications</div>
            </div>
          )}
          <div className="space-y-2">
            {notifications.map((n) => (
              <div key={n.id} className={`rounded-xl p-4 ${n.isRead ? "bg-gray-50" : "bg-blue-50 border border-blue-100"}`}>
                <div className="flex items-center gap-2">
                  {!n.isRead && <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />}
                  <span className="text-sm font-semibold text-gray-900">{n.title}</span>
                  <span className="ml-auto text-xs text-gray-400">{new Date(n.createdAt).toLocaleDateString("en-IN")}</span>
                </div>
                <p className="mt-1 text-sm text-gray-600 pl-4">{n.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
