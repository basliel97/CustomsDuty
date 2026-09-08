"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api-client";
import type { Notification } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  INFO: { label: "Info", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  SUCCESS: { label: "Success", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  WARNING: { label: "Warning", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  ERROR: { label: "Error", className: "bg-red-50 text-red-700 ring-red-200" },
  ASSESSMENT_UPDATE: { label: "Assessment", className: "bg-violet-50 text-violet-700 ring-violet-200" },
  SYSTEM: { label: "System", className: "bg-gray-100 text-gray-700 ring-gray-200" },
};

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-ET");
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = () => {
    setLoading(true);
    api
      .get<Notification[]>("/notifications")
      .then((res) => setNotifications((res.data ?? []) as Notification[]))
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await api.put("/notifications/read-all");
      fetchNotifications();
    } catch {
      // ignore
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <RequireAuth>
      <AppShell>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
              <p className="text-sm text-gray-500">
                {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}` : "All caught up"}
              </p>
            </div>
            {unreadCount > 0 ? (
              <Button variant="outline" size="sm" onClick={markAllRead} disabled={markingAll}>
                <CheckCheck className="h-4 w-4" aria-hidden /> Mark all as read
              </Button>
            ) : null}
          </div>

          {loading ? (
            <PageLoader label="Loading notifications..." />
          ) : notifications.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12">
                <Bell className="mb-3 h-10 w-10 text-gray-300" aria-hidden />
                <p className="text-sm text-gray-500">No notifications yet.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent>
                <ul className="divide-y divide-gray-100">
                  {notifications.map((n) => {
                    const typeConfig = TYPE_BADGE[n.type ?? "INFO"] ?? TYPE_BADGE.INFO;
                    return (
                      <li key={n.id} className={`flex items-start gap-4 py-4 first:pt-0 last:pb-0 ${!n.is_read ? "bg-blue-50/40 -mx-5 px-5" : ""}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={`text-sm font-medium ${n.is_read ? "text-gray-700" : "text-gray-900"}`}>
                              {n.title ?? "Notification"}
                            </p>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${typeConfig.className}`}>
                              {typeConfig.label}
                            </span>
                            {!n.is_read ? (
                              <span className="h-2 w-2 rounded-full bg-blue-500" aria-label="Unread" />
                            ) : null}
                          </div>
                          {n.message ? (
                            <p className="mt-0.5 text-sm text-gray-500">{n.message}</p>
                          ) : null}
                          <p className="mt-1 text-xs text-gray-400">{formatRelative(n.created_at)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
