"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession, signOut } from "@/services/auth";
import {
  listIncidentsAdvanced,
  Incident,
  IncidentFilterParams,
} from "@/services/incidents";
import { getActiveOrgDetails, Organization } from "@/services/org";
import { getMyRoleInActiveOrg } from "@/services/members";

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

export default function IncidentsPage() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const [owner, setOwner] = useState<"any" | "me">("any");
  const [sort, setSort] = useState<IncidentFilterParams["sort"]>("created_desc");

  const fetchIncidents = useCallback(
    async (params: IncidentFilterParams = {}) => {
      try {
        setSearching(true);
        const data = await listIncidentsAdvanced(params);
        setIncidents(data);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Failed to load incidents"
        );
      } finally {
        setSearching(false);
      }
    },
    []
  );

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
        const role = await getMyRoleInActiveOrg();
        setMyRole(role);
        await fetchIncidents();
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router, fetchIncidents]);

  function handleApplyFilters() {
    setError(null);
    fetchIncidents({ q: q || undefined, severity, status, owner, sort });
  }

  function handleReset() {
    setQ("");
    setSeverity("all");
    setStatus("all");
    setOwner("any");
    setSort("created_desc");
    setError(null);
    fetchIncidents();
  }

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

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">NettSOC</h1>
            <p className="text-sm text-zinc-500">
              {activeOrg ? activeOrg.name : "Incident Tracker"}
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
            {myRole && myRole !== "viewer" && (
              <Link
                href="/incidents/new"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                Create Incident
              </Link>
            )}
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

        {/* Filters */}
        <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Search */}
            <div className="sm:col-span-2 lg:col-span-3">
              <input
                type="text"
                placeholder="Search title or summary…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
                className="block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Severity */}
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                Severity
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">All</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="contained">Contained</option>
                <option value="eradicated">Eradicated</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Owner */}
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                Owner
              </label>
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value as "any" | "me")}
                className="block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="any">Anyone</option>
                <option value="me">My Incidents</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                Sort
              </label>
              <select
                value={sort}
                onChange={(e) =>
                  setSort(e.target.value as IncidentFilterParams["sort"])
                }
                className="block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="created_desc">Newest First</option>
                <option value="updated_desc">Recently Updated</option>
                <option value="severity_desc">Severity (High→Low)</option>
              </select>
            </div>

            {/* Buttons */}
            <div className="flex items-end gap-2">
              <button
                onClick={handleApplyFilters}
                disabled={searching}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {searching ? "Searching…" : "Apply"}
              </button>
              <button
                onClick={handleReset}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-900/50 border border-red-700 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Incidents List */}
        {incidents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-700 py-16 text-center">
            <p className="text-zinc-500">
              No incidents found. Try adjusting your filters.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((incident) => (
              <Link
                key={incident.id}
                href={`/incidents/${incident.id}`}
                className="block rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4 transition hover:border-zinc-600"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-white truncate">
                      {incident.title}
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      {new Date(incident.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        severityColors[incident.severity] ||
                        "bg-zinc-800 text-zinc-400 border-zinc-700"
                      }`}
                    >
                      {incident.severity}
                    </span>
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        statusColors[incident.status] ||
                        "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {incident.status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
