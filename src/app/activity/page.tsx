"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/services/auth";
import { getActivityFeed, ActivityEntry, ActivityFilters } from "@/services/activity";
import { getProfilesByIds, Profile } from "@/services/profiles";
import { getActiveOrgDetails, Organization } from "@/services/org";
import AppShell from "@/components/AppShell";

export default function ActivityPage() {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");
  const [userIdFilter, setUserIdFilter] = useState("");

  useEffect(() => {
    async function init() {
      try {
        const session = await getSession();
        if (!session) {
          router.push("/login");
          return;
        }
        const org = await getActiveOrgDetails();
        if (!org) {
          router.push("/org");
          return;
        }
        setActiveOrg(org);
        await fetchActivity();
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  async function fetchActivity() {
    try {
      const filters: ActivityFilters = {};
      if (entityTypeFilter !== "all") {
        filters.entityType = entityTypeFilter;
      }
      if (userIdFilter) {
        filters.userId = userIdFilter;
      }

      const data = await getActivityFeed(filters);
      setActivities(data);

      // Fetch profiles for all users
      const userIds = [...new Set(data.map(a => a.user_id).filter(Boolean) as string[])];
      if (userIds.length > 0) {
        const profileMap = await getProfilesByIds(userIds);
        setProfiles(profileMap);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
    }
  }

  function handleApplyFilters() {
    fetchActivity();
  }

  function handleReset() {
    setEntityTypeFilter("all");
    setUserIdFilter("");
    fetchActivity();
  }

  const actionIcons: Record<string, string> = {
    created: "➕",
    updated: "✏️",
    deleted: "🗑️",
    commented: "💬",
    uploaded: "📎",
    assigned: "👤",
    closed: "✅",
  };

  const entityTypeColors: Record<string, string> = {
    incident: "bg-red-50 text-red-600",
    comment: "bg-blue-50 text-blue-600",
    evidence: "bg-purple-50 text-purple-600",
    timeline: "bg-amber-50 text-amber-600",
  };

  return (
    <AppShell title="Activity Feed" subtitle={activeOrg ? activeOrg.name : "Recent Activity"}>
      {/* Filters */}
      <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Entity Type
            </label>
            <select
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="incident">Incidents</option>
              <option value="comment">Comments</option>
              <option value="evidence">Evidence</option>
              <option value="timeline">Timeline</option>
            </select>
          </div>

          <div className="flex items-end gap-2 sm:col-span-2">
            <button
              onClick={handleApplyFilters}
              className="rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Apply
            </button>
            <button
              onClick={handleReset}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted transition hover:bg-background hover:text-foreground"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-white px-5 py-4 shadow-sm animate-pulse">
              <div className="h-4 w-64 rounded bg-zinc-200" />
              <div className="mt-2 h-3 w-48 rounded bg-zinc-100" />
            </div>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-sm border border-dashed border-border py-16 text-center">
          <p className="text-muted">No activity yet</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
          {activities.map((activity, idx) => (
            <div
              key={activity.id}
              className={`px-5 py-4 transition hover:bg-card-hover ${
                idx !== 0 ? "border-t border-border" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl">{actionIcons[activity.action] || "📋"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">
                      {activity.user_id && profiles[activity.user_id]
                        ? profiles[activity.user_id].display_name || "Unknown User"
                        : "System"}
                    </span>
                    <span className="text-sm text-muted">{activity.action}</span>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        entityTypeColors[activity.entity_type] || "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {activity.entity_type}
                    </span>
                  </div>
                  {activity.entity_title && (
                    <p className="mt-1 text-sm text-foreground">
                      {activity.entity_id && activity.entity_type === "incident" ? (
                        <Link
                          href={`/incidents/${activity.entity_id}`}
                          className="hover:underline text-accent"
                        >
                          {activity.entity_title}
                        </Link>
                      ) : (
                        activity.entity_title
                      )}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    {new Date(activity.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
