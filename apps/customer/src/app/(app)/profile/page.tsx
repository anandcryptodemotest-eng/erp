"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearAuth } from "@/lib/api-client";

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

const emptyAddr = {
  label: "Site",
  line1: "",
  city: "",
  state: "",
  pincode: "",
  isDefault: false,
};

export default function ProfilePage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [tab, setTab] = useState<"info" | "addresses" | "notifications">("info");
  const [loading, setLoading] = useState(true);
  const [showAddAddr, setShowAddAddr] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addrForm, setAddrForm] = useState(emptyAddr);
  const [savingAddr, setSavingAddr] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const [custRes, notifRes] = await Promise.all([
      api<{ data: Customer & { addresses?: Address[] } }>("sales", "/api/customers/me"),
      api<{ data: Notification[] }>("gateway", "/api/notifications?limit=30"),
    ]);
    if (!custRes.error && custRes.data?.data) {
      const cust = custRes.data.data;
      setCustomer(cust);
      setAddresses(cust.addresses ?? []);
    }
    if (!notifRes.error) setNotifications(notifRes.data.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function refreshAddresses() {
    if (!customer) return;
    const addrRes = await api<{ data: Address[] }>("sales", `/api/customers/${customer.id}/addresses`);
    if (!addrRes.error) setAddresses(addrRes.data.data);
  }

  async function saveAddress() {
    if (!customer) return;
    setSavingAddr(true);
    setMsg("");
    const res = editingId
      ? await api("sales", `/api/customers/${customer.id}/addresses/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(addrForm),
        })
      : await api("sales", `/api/customers/${customer.id}/addresses`, {
          method: "POST",
          body: JSON.stringify(addrForm),
        });
    setSavingAddr(false);
    if (res.error) {
      setMsg(res.error);
      return;
    }
    await refreshAddresses();
    setShowAddAddr(false);
    setEditingId(null);
    setAddrForm(emptyAddr);
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
          {customer ? (
            <div className="rounded-xl border border-gray-100 bg-white divide-y divide-gray-100">
              {[
                { label: "Name", value: customer.name },
                { label: "Phone", value: customer.phone || "—" },
                { label: "Email", value: customer.email || "—" },
                { label: "Group", value: customer.customerGroup ?? "Regular" },
              ].map((row) => (
                <div key={row.label} className="flex justify-between px-4 py-3 text-sm">
                  <span className="text-gray-500">{row.label}</span>
                  <span className="font-medium text-gray-900">{row.value}</span>
                </div>
              ))}
            </div>
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
          <div className="space-y-2 mb-4">
            {addresses.map((a) => (
              <div key={a.id} className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-800">{a.label}</span>
                  {a.isDefault && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 font-medium">
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
                    <button type="button" className="text-slate-700" onClick={() => setDefault(a)}>
                      Set default
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-slate-700"
                    onClick={() => {
                      setEditingId(a.id);
                      setAddrForm({
                        label: a.label,
                        line1: a.line1,
                        city: a.city,
                        state: a.state ?? "",
                        pincode: a.pincode,
                        isDefault: a.isDefault,
                      });
                      setShowAddAddr(true);
                    }}
                  >
                    Edit
                  </button>
                  <button type="button" className="text-red-600" onClick={() => deleteAddress(a.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {!showAddAddr && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setAddrForm(emptyAddr);
                setShowAddAddr(true);
              }}
              className="w-full rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-medium text-slate-700"
            >
              + Add New Address
            </button>
          )}

          {showAddAddr && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
              <div className="text-sm font-semibold text-gray-700">
                {editingId ? "Edit Address" : "New Address"}
              </div>
              {(
                [
                  { key: "label", placeholder: "Label (e.g. Site Office)" },
                  { key: "line1", placeholder: "Street / Flat / Building" },
                  { key: "city", placeholder: "City" },
                  { key: "state", placeholder: "State" },
                  { key: "pincode", placeholder: "Pincode" },
                ] as const
              ).map(({ key, placeholder }) => (
                <input
                  key={key}
                  placeholder={placeholder}
                  value={addrForm[key]}
                  onChange={(e) => setAddrForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                />
              ))}
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={addrForm.isDefault}
                  onChange={(e) => setAddrForm((f) => ({ ...f, isDefault: e.target.checked }))}
                />
                Set as default
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveAddress}
                  disabled={savingAddr}
                  className="flex-1 rounded-full bg-slate-900 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {savingAddr ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddAddr(false);
                    setEditingId(null);
                  }}
                  className="flex-1 rounded-full border border-gray-200 py-2.5 text-sm font-medium text-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "notifications" && (
        <div className="px-4 py-4">
          {unread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
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
                onClick={() => markRead(n)}
                className={`w-full text-left rounded-xl p-4 ${
                  n.isRead ? "bg-gray-50" : "bg-sky-50 border border-sky-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  {!n.isRead && <span className="h-2 w-2 rounded-full bg-sky-500 flex-shrink-0" />}
                  <span className="text-sm font-semibold text-gray-900">{n.title}</span>
                  <span className="ml-auto text-xs text-gray-400">
                    {new Date(n.createdAt).toLocaleDateString("en-IN")}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600 pl-4">{n.body}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
