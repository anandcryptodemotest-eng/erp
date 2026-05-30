"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@erp/ui";
import { api } from "@/lib/api-client";

interface Notification { id: string; title: string; body: string; type: string; isRead: boolean; createdAt: string }

export default function SettingsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [pushType, setPushType] = useState("ANNOUNCEMENT");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api<{ data: Notification[] }>("gateway", "/api/notifications?limit=20").then((r) => {
      if (!r.error) setNotifications(r.data.data);
    });
  }, []);

  async function sendBroadcast() {
    if (!pushTitle || !pushBody) return;
    setSending(true);
    setMsg("");
    const res = await api("gateway", "/api/notifications/push", {
      method: "POST",
      body: JSON.stringify({ type: pushType, title: pushTitle, body: pushBody }),
    });
    setSending(false);
    setMsg(res.error ?? `Sent to all users`);
    setPushTitle(""); setPushBody("");
  }

  async function markAllRead() {
    await api("gateway", "/api/notifications", { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Settings & Notifications</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Broadcast push */}
        <Card>
          <CardHeader><CardTitle>Send Push Notification</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
              <input value={pushType} onChange={(e) => setPushType(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
              <input value={pushTitle} onChange={(e) => setPushTitle(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Message</label>
              <textarea value={pushBody} onChange={(e) => setPushBody(e.target.value)} rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            {msg && <p className="text-sm text-blue-600">{msg}</p>}
            <Button onClick={sendBroadcast} disabled={sending || !pushTitle || !pushBody}>
              {sending ? "Sending…" : "Broadcast to all users"}
            </Button>
          </CardContent>
        </Card>

        {/* In-app inbox */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>My Notifications</CardTitle>
            <Button size="sm" variant="outline" onClick={markAllRead}>Mark all read</Button>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {notifications.length === 0 && <p className="py-4 text-sm text-gray-400">No notifications</p>}
              {notifications.map((n) => (
                <div key={n.id} className={`py-3 ${n.isRead ? "opacity-60" : ""}`}>
                  <div className="flex items-center gap-2">
                    {!n.isRead && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                    <span className="text-sm font-medium text-gray-900">{n.title}</span>
                    <span className="ml-auto text-xs text-gray-400">{new Date(n.createdAt).toLocaleDateString("en-IN")}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-gray-600 pl-4">{n.body}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
