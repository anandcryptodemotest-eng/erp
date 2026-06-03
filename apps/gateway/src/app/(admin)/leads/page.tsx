"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/admin-api";
import LeadToCashGuide from "@/components/LeadToCashGuide";
import LeadToCashUnderstanding from "@/components/LeadToCashUnderstanding";

interface Lead {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

interface Opportunity {
  id: string;
  title: string;
  stage: string;
  value: number;
}

interface CustomerLite {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "DISQUALIFIED" | "CONVERTED";

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-yellow-100 text-yellow-800",
  QUALIFIED: "bg-green-100 text-green-700",
  DISQUALIFIED: "bg-red-100 text-red-600",
  CONVERTED: "bg-indigo-100 text-indigo-700",
};

const LIFECYCLE: Array<{ status: LeadStatus; label: string; hint: string }> = [
  { status: "NEW", label: "New", hint: "Lead captured" },
  { status: "CONTACTED", label: "Contacted", hint: "First touch done" },
  { status: "QUALIFIED", label: "Qualified", hint: "Fit confirmed" },
  { status: "CONVERTED", label: "Converted", hint: "Opportunity created" },
  { status: "DISQUALIFIED", label: "Disqualified", hint: "Not pursuing" },
];

const ALLOWED_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW: ["CONTACTED", "DISQUALIFIED"],
  CONTACTED: ["QUALIFIED", "DISQUALIFIED"],
  QUALIFIED: ["CONVERTED", "DISQUALIFIED"],
  CONVERTED: [],
  DISQUALIFIED: [],
};

const SOURCES = ["REFERRAL", "WEB", "SOCIAL", "EVENT", "COLD_CALL", "OTHER"];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("WEB");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Detail drawer
  const [selected, setSelected] = useState<Lead | null>(null);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [convertTitle, setConvertTitle] = useState("");
  const [convertValue, setConvertValue] = useState("");
  const [createOrLinkCustomer, setCreateOrLinkCustomer] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [converting, setConverting] = useState(false);

  // Filter
  const [statusFilter, setStatusFilter] = useState("");

  const statusCounts = LIFECYCLE.reduce((acc, step) => {
    acc[step.status] = leads.filter((l) => l.status === step.status).length;
    return acc;
  }, {} as Record<LeadStatus, number>);

  function notify(text: string, type: "ok" | "err" = "ok") {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(""), 3500);
  }

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter) params.set("status", statusFilter);
      const [leadRes, customerRes] = await Promise.all([
        api(`/api/leads?${params}`),
        api("/api/customers?limit=200"),
      ]);
      setLeads(leadRes.data);
      setTotal(leadRes.meta?.total ?? leadRes.data.length);
      setCustomers(customerRes.data ?? []);
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Failed to load leads", "err");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openDetail(lead: Lead) {
    setSelected(lead);
    setConvertTitle(lead.company ? `${lead.company} — Opportunity` : `${lead.name} — Opportunity`);
    setConvertValue("");
    setCreateOrLinkCustomer(true);
    setCustomerName(lead.company || lead.name);
    setCustomerEmail(lead.email || "");
    setCustomerPhone(lead.phone || "");
    try {
      const res = await api(`/api/opportunities?limit=100`);
      setOpps(res.data.filter((o: Opportunity & { leadId?: string }) => o.leadId === lead.id));
    } catch {
      setOpps([]);
    }
  }

  function findMatchingCustomer() {
    const email = customerEmail.trim().toLowerCase();
    const phone = customerPhone.trim();
    return customers.find((c) =>
      (email && c.email?.toLowerCase() === email) ||
      (phone && c.phone === phone)
    );
  }

  async function createLead() {
    if (!name.trim()) { notify("Name is required", "err"); return; }
    setSaving(true);
    try {
      await api("/api/leads", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), company: company.trim() || undefined, email: email.trim() || undefined, phone: phone.trim() || undefined, source, notes: notes.trim() || undefined }),
      });
      notify("Lead created");
      setShowForm(false);
      setName(""); setCompany(""); setEmail(""); setPhone(""); setNotes(""); setSource("WEB");
      load();
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Failed to create lead", "err");
    } finally {
      setSaving(false);
    }
  }

  function getAllowedNextStatuses(status: LeadStatus): LeadStatus[] {
    return ALLOWED_TRANSITIONS[status] ?? [];
  }

  async function updateStatus(lead: Lead, status: LeadStatus) {
    if (lead.status === status) return;
    if (!getAllowedNextStatuses(lead.status as LeadStatus).includes(status)) {
      notify(`Cannot move from ${lead.status} to ${status}`, "err");
      return;
    }
    try {
      await api(`/api/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      notify(`Status updated to ${status}`);
      if (selected?.id === lead.id) setSelected({ ...selected, status });
      load();
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Failed to update status", "err");
    }
  }

  async function convertToOpportunity() {
    if (!selected || !convertTitle.trim()) { notify("Title is required", "err"); return; }
    if (selected.status !== "QUALIFIED") { notify("Only QUALIFIED leads can be converted", "err"); return; }
    setConverting(true);
    try {
      if (createOrLinkCustomer && !customerName.trim()) {
        notify("Customer name is required when customer auto-create is enabled", "err");
        setConverting(false);
        return;
      }

      await api(`/api/leads/${selected.id}?action=convert`, {
        method: "PATCH",
        body: JSON.stringify({
          title: convertTitle.trim(),
          value: Number(convertValue) || 0,
          createOrLinkCustomer,
          customer: {
            name: customerName.trim() || undefined,
            email: customerEmail.trim() || undefined,
            phone: customerPhone.trim() || undefined,
          },
        }),
      });

      notify(createOrLinkCustomer ? "Converted. Opportunity created and customer linked." : "Converted to opportunity successfully.");
      load();
      const updated = { ...selected, status: "CONVERTED" };
      setSelected(updated);
      const res = await api(`/api/opportunities?limit=100`);
      setOpps(res.data.filter((o: Opportunity & { leadId?: string }) => o.leadId === selected.id));
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Failed to convert", "err");
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="p-6">
      <LeadToCashGuide current="leads" />
      <LeadToCashUnderstanding current="leads" />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500">{total} total leads</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition">
          + New Lead
        </button>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${msgType === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg}
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 md:grid-cols-5 gap-2">
        {LIFECYCLE.map((step) => {
          const active = statusFilter === step.status;
          return (
            <button
              key={step.status}
              onClick={() => setStatusFilter(active ? "" : step.status)}
              className={`rounded-lg border p-3 text-left transition ${
                active ? "border-emerald-300 bg-emerald-50" : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">{step.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[step.status]}`}>{statusCounts[step.status] ?? 0}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">{step.hint}</p>
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 mb-4">
        {["", "NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "DISQUALIFIED"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${statusFilter === s ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white border rounded-xl p-5 mb-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">New Lead</h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Contact name"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Company</label>
              <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company name"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="email@example.com"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 9XXXXXXXXX"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Source</label>
              <select value={source} onChange={e => setSource(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                {SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={createLead} disabled={saving}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              {saving ? "Saving..." : "Create Lead"}
            </button>
          </div>
        </div>
      )}

      {/* Leads table */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : leads.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No leads yet. Create your first lead above.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Company</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Source</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {leads.map(lead => (
                <tr key={lead.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openDetail(lead)}>
                  <td className="px-4 py-3 font-medium text-gray-900">{lead.name}</td>
                  <td className="px-4 py-3 text-gray-600">{lead.company ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {lead.email && <div>{lead.email}</div>}
                    {lead.phone && <div>{lead.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{lead.source ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[lead.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(lead.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    {getAllowedNextStatuses(lead.status as LeadStatus).length > 0 ? (
                      <select
                        defaultValue=""
                        onChange={e => {
                          const nextStatus = e.target.value as LeadStatus;
                          if (nextStatus) updateStatus(lead, nextStatus);
                        }}
                        className="text-xs border rounded px-2 py-1 text-gray-600 focus:outline-none"
                        title="Move to next status">
                        <option value="">Move to...</option>
                        {getAllowedNextStatuses(lead.status as LeadStatus).map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-gray-400">No further action</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="w-96 bg-white h-full shadow-2xl overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">{selected.name}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>

            <div className="space-y-2 text-sm mb-5">
              <div className="flex justify-between"><span className="text-gray-500">Company</span><span className="font-medium">{selected.company ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Email</span><span>{selected.email ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Phone</span><span>{selected.phone ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Source</span><span>{selected.source ?? "—"}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Status</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selected.status] ?? "bg-gray-100 text-gray-600"}`}>{selected.status}</span>
              </div>
              {selected.notes && <div className="pt-2 text-gray-600 border-t">{selected.notes}</div>}
            </div>

            {/* Linked opportunities */}
            {opps.length > 0 && (
              <div className="mb-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Linked Opportunities</h3>
                <div className="space-y-2">
                  {opps.map(o => (
                    <div key={o.id} className="border rounded-lg p-3 text-sm">
                      <div className="font-medium text-gray-800">{o.title}</div>
                      <div className="text-xs text-gray-500 mt-1">{o.stage} — ₹{Number(o.value).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Convert to opportunity */}
            {selected.status === "QUALIFIED" && (
              <div className="border rounded-xl p-4 bg-green-50">
                <h3 className="text-sm font-semibold text-green-800 mb-3">Convert to Opportunity</h3>
                <div className="space-y-2">
                  <input value={convertTitle} onChange={e => setConvertTitle(e.target.value)}
                    placeholder="Opportunity title *"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <input value={convertValue} onChange={e => setConvertValue(e.target.value)}
                    type="number" placeholder="Expected value (₹)"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />

                  <label className="flex items-center gap-2 rounded-lg border border-green-200 bg-white px-3 py-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={createOrLinkCustomer}
                      onChange={(e) => setCreateOrLinkCustomer(e.target.checked)}
                    />
                    Auto create/link customer while converting
                  </label>

                  {createOrLinkCustomer && (
                    <div className="rounded-lg border bg-white p-3 space-y-2">
                      <p className="text-xs font-medium text-gray-600">Customer details (used to create or match)</p>
                      <input
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Customer/Company name *"
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <input
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="Email (optional)"
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <input
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Phone (optional)"
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      {findMatchingCustomer() && (
                        <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                          Existing customer will be linked: {findMatchingCustomer()?.name}
                        </p>
                      )}
                    </div>
                  )}

                  <button onClick={convertToOpportunity} disabled={converting}
                    className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                    {converting ? "Converting..." : "Convert → Opportunity"}
                  </button>
                </div>
              </div>
            )}

            {selected.status === "CONVERTED" && (
              <div className="border rounded-xl p-4 bg-indigo-50 border-indigo-200">
                <h3 className="text-sm font-semibold text-indigo-800 mb-2">Lead already converted</h3>
                <p className="text-xs text-indigo-700">Next step: open Quotes page to create and send quote for this opportunity.</p>
              </div>
            )}

            {/* Status actions */}
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Allowed Next Status</h3>
              <div className="flex flex-wrap gap-2">
                {getAllowedNextStatuses(selected.status as LeadStatus).map(s => (
                  <button key={s} onClick={() => updateStatus(selected, s as LeadStatus)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${selected.status === s ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-white text-gray-700 hover:bg-gray-50 border-gray-300"}`}>
                    {s}
                  </button>
                ))}
                {getAllowedNextStatuses(selected.status as LeadStatus).length === 0 && (
                  <span className="text-xs text-gray-400">This status is terminal.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
