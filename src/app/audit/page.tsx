"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/services/auth";
import { getActiveOrgDetails, Organization } from "@/services/org";
import { listAuditLogs, AuditLogEntry } from "@/services/audit";
import { getProfilesByIds, Profile } from "@/services/profiles";
import AppShell from "@/components/AppShell";

const actionColors: Record<string, string> = {
  create: "bg-emerald-50 text-emerald-600",
  update: "bg-blue-50 text-blue-600",
  delete: "bg-red-50 text-red-600",
  invite: "bg-purple-50 text-purple-600",
  join: "bg-indigo-50 text-indigo-600",
};

export default function AuditLogPage() {
  const router = useRouter();
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [entityTypeFilter, setEntityTypeFilter] = useState("all");

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

        const auditLogs = await listAuditLogs({ limit: 100 });
        setLogs(auditLogs);

        const userIds = Array.from(new Set(auditLogs.map((log) => log.user_id)));
        if (userIds.length > 0) {
          const profiles = await getProfilesByIds(userIds);
          setProfileMap(profiles);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  async function handleFilterChange(entityType: string) {
    setEntityTypeFilter(entityType);
    setLoading(true);
    setError(null);
    try {
      const params = entityType === "all" ? {} : { entity_type: entityType };
      const auditLogs = await listAuditLogs({ ...params, limit: 100 });
      setLogs(auditLogs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to filter logs");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title="Audit Log" subtitle={activeOrg?.name || "Organization"}>
      {/* Filter */}
      <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
        <label htmlFor="entityFilter" className="block text-sm font-medium text-foreground mb-2">
          Filter by Entity Type
        </label>
        <select
          id="entityFilter"
          value={entityTypeFilter}
          onChange={(e) => handleFilterChange(e.target.value)}
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
        >
          <option value="all">All</option>
          <option value="incident">Incidents</option>
          <option value="member">Members</option>
          <option value="invite">Invites</option>
          <option value="organization">Organizations</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Audit Log List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-white px-5 py-4 shadow-sm animate-pulse">
              <div className="h-4 w-48 rounded bg-zinc-200" />
              <div className="mt-2 h-3 w-32 rounded bg-zinc-100" />
            </div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-sm border border-dashed border-border py-16 text-center">
          <p className="text-muted">No audit logs found.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
          {logs.map((log, idx) => (
            <div
              key={log.id}
              className={`px-5 py-4 ${idx !== 0 ? "border-t border-border" : ""}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        actionColors[log.action] || "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {log.action}
                    </span>
                    <span className="text-xs font-medium text-muted uppercase">
                      {log.entity_type}
                    </span>
                    {log.entity_id && (
                      <span className="text-xs text-muted font-mono">
                        {log.entity_id.slice(0, 8)}…
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span>
                      {profileMap[log.user_id]?.display_name || log.user_id.slice(0, 8) + "…"}
                    </span>
                    <span>·</span>
                    <span>{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                  {log.details && (
                    <div className="mt-2 rounded-xl bg-background px-3 py-2">
                      <pre className="text-xs text-muted overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
