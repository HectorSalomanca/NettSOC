"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession, signOut } from "@/services/auth";
import { getActiveOrgDetails, Organization } from "@/services/org";
import { listAuditLogs, AuditLogEntry } from "@/services/audit";
import { getProfilesByIds, Profile } from "@/services/profiles";

const actionColors: Record<string, string> = {
  create: "bg-green-900/50 text-green-300",
  update: "bg-blue-900/50 text-blue-300",
  delete: "bg-red-900/50 text-red-300",
  invite: "bg-purple-900/50 text-purple-300",
  join: "bg-indigo-900/50 text-indigo-300",
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

  async function handleSignOut() {
    try {
      await signOut();
      router.push("/login");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign out");
    }
  }

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="flex items-center gap-3 text-zinc-400">
          <svg
            className="h-5 w-5 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Audit Log</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {activeOrg?.name || "Organization"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
            >
              Dashboard
            </Link>
            <Link
              href="/incidents"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
            >
              Incidents
            </Link>
            <Link
              href="/org"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
            >
              Organizations
            </Link>
            <Link
              href="/profile"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
            >
              Profile
            </Link>
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <label htmlFor="entityFilter" className="block text-sm font-medium text-zinc-300 mb-2">
            Filter by Entity Type
          </label>
          <select
            id="entityFilter"
            value={entityTypeFilter}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
          <div className="mb-6 rounded-lg bg-red-900/50 border border-red-700 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Audit Log List */}
        {logs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-700 py-16 text-center">
            <p className="text-zinc-500">No audit logs found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          actionColors[log.action] || "bg-zinc-700 text-zinc-300"
                        }`}
                      >
                        {log.action}
                      </span>
                      <span className="text-xs font-medium text-zinc-400 uppercase">
                        {log.entity_type}
                      </span>
                      {log.entity_id && (
                        <span className="text-xs text-zinc-600 font-mono">
                          {log.entity_id.slice(0, 8)}…
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span>
                        {profileMap[log.user_id]?.display_name || log.user_id.slice(0, 8) + "…"}
                      </span>
                      <span>·</span>
                      <span>{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    {log.details && (
                      <div className="mt-2 rounded bg-zinc-800/50 px-3 py-2">
                        <pre className="text-xs text-zinc-400 overflow-x-auto">
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
      </div>
    </div>
  );
}
