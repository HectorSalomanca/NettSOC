"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession, signOut } from "@/services/auth";
import {
  getDashboardStats,
  DashboardStats,
  Incident,
} from "@/services/incidents";
import { getActiveOrgDetails, Organization } from "@/services/org";

const severityColors: Record<string, string> = {
  low: "bg-blue-900/50 text-blue-300 border-blue-700",
  medium: "bg-yellow-900/50 text-yellow-300 border-yellow-700",
  high: "bg-orange-900/50 text-orange-300 border-orange-700",
  critical: "bg-red-900/50 text-red-300 border-red-700",
};

const statusColors: Record<string, string> = {
  open: "bg-red-900/40 text-red-300",
  investigating: "bg-yellow-900/40 text-yellow-300",
  contained: "bg-blue-900/40 text-blue-300",
  eradicated: "bg-emerald-900/40 text-emerald-300",
  closed: "bg-zinc-800 text-zinc-400",
};

function KpiCard({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-sm font-medium text-zinc-400">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{count}</p>
    </div>
  );
}

function IncidentRow({ incident }: { incident: Incident }) {
  return (
    <Link
      href={`/incidents/${incident.id}`}
      className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 transition hover:bg-zinc-800"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">
          {incident.title}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {new Date(
            incident.updated_at || incident.created_at
          ).toLocaleString()}
        </p>
      </div>
      <div className="ml-3 flex items-center gap-2">
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
            severityColors[incident.severity] || "bg-zinc-800 text-zinc-400"
          }`}
        >
          {incident.severity}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            statusColors[incident.status] || "bg-zinc-800 text-zinc-400"
          }`}
        >
          {incident.status}
        </span>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
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
        const org = await getActiveOrgDetails();
        if (!org) {
          router.push("/org");
          return;
        }
        setActiveOrg(org);
        const dashStats = await getDashboardStats();
        setStats(dashStats);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Failed to load dashboard"
        );
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

  const totalIncidents =
    stats
      ? Object.values(stats.statusCounts).reduce((a, b) => a + b, 0)
      : 0;

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-sm text-zinc-500">
              {activeOrg ? activeOrg.name : "NettSOC"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/incidents"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
            >
              Incidents
            </Link>
            <Link
              href="/org/members"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
            >
              Members
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

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-900/50 border border-red-700 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {stats && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 mb-8">
              <KpiCard
                label="Total"
                count={totalIncidents}
                color="text-white"
              />
              <KpiCard
                label="Open"
                count={stats.statusCounts.open}
                color="text-red-400"
              />
              <KpiCard
                label="Critical"
                count={stats.severityCounts.critical}
                color="text-red-300"
              />
              <KpiCard
                label="Investigating"
                count={stats.statusCounts.investigating}
                color="text-yellow-300"
              />
              <KpiCard
                label="Closed"
                count={stats.statusCounts.closed}
                color="text-zinc-400"
              />
            </div>

            {/* Severity Breakdown */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-3">
                Severity Breakdown
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(["low", "medium", "high", "critical"] as const).map(
                  (sev) => (
                    <div
                      key={sev}
                      className={`rounded-lg border px-4 py-3 text-center ${
                        severityColors[sev]
                      }`}
                    >
                      <p className="text-xs font-medium uppercase">{sev}</p>
                      <p className="mt-1 text-2xl font-bold">
                        {stats.severityCounts[sev]}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Two-column lists */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Critical Open */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">
                  Critical &amp; Open
                </h2>
                {stats.criticalOpen.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-zinc-700 py-8 text-center">
                    <p className="text-zinc-500 text-sm">
                      No critical open incidents
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stats.criticalOpen.map((inc) => (
                      <IncidentRow key={inc.id} incident={inc} />
                    ))}
                  </div>
                )}
              </div>

              {/* Recently Updated */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">
                  Recently Updated
                </h2>
                {stats.recentlyUpdated.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-zinc-700 py-8 text-center">
                    <p className="text-zinc-500 text-sm">No incidents yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stats.recentlyUpdated.map((inc) => (
                      <IncidentRow key={inc.id} incident={inc} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
