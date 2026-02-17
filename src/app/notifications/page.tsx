"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/services/auth";
import { getMyNotifications, markAsRead, markAllAsRead, Notification } from "@/services/notifications_v2";
import AppShell from "@/components/AppShell";

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const session = await getSession();
        if (!session) {
          router.push("/login");
          return;
        }
        const data = await getMyNotifications();
        setNotifications(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load notifications");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  async function handleMarkAsRead(id: string) {
    try {
      await markAsRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to mark as read");
    }
  }

  async function handleMarkAllAsRead() {
    try {
      await markAllAsRead();
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to mark all as read");
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  const typeIcons: Record<string, string> = {
    incident_assign: "📌",
    mention: "💬",
    incident_critical: "🚨",
    incident_due_soon: "⏰",
    incident_overdue: "⚠️",
    status_change: "🔄",
  };

  return (
    <AppShell title="Notifications" subtitle={`${unreadCount} unread`}>
      {error && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {unreadCount > 0 && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={handleMarkAllAsRead}
            className="rounded-xl bg-background border border-border px-4 py-2 text-xs font-medium text-foreground transition hover:bg-card-hover"
          >
            Mark all as read
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-white px-5 py-4 shadow-sm animate-pulse">
              <div className="h-4 w-64 rounded bg-zinc-200" />
              <div className="mt-2 h-3 w-48 rounded bg-zinc-100" />
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-sm border border-dashed border-border py-16 text-center">
          <p className="text-muted">No notifications yet</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
          {notifications.map((notification, idx) => (
            <div
              key={notification.id}
              className={`px-5 py-4 transition hover:bg-card-hover ${
                idx !== 0 ? "border-t border-border" : ""
              } ${!notification.read ? "bg-accent/5" : ""}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{typeIcons[notification.type] || "📬"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      {notification.title}
                    </h3>
                    {!notification.read && (
                      <button
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="shrink-0 text-xs text-accent hover:underline"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-foreground">{notification.message}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <p className="text-xs text-muted">
                      {new Date(notification.created_at).toLocaleString()}
                    </p>
                    {notification.entity_id && notification.entity_type === "incident" && (
                      <Link
                        href={`/incidents/${notification.entity_id}`}
                        className="text-xs text-accent hover:underline"
                      >
                        View incident →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
