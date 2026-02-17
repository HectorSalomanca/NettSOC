"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/services/auth";
import {
  listIncidentsAdvanced,
  Incident,
  IncidentFilterParams,
} from "@/services/incidents";
import { getActiveOrgDetails, Organization } from "@/services/org";
import { getMyRoleInActiveOrg } from "@/services/members";
import { bulkAddTagToIncidents, listTags, getOrCreateTag, IncidentTag } from "@/services/templates";
import AppShell from "@/components/AppShell";

const severityColors: Record<string, string> = {
  low: "bg-blue-50 text-blue-600",
  medium: "bg-amber-50 text-amber-600",
  high: "bg-orange-50 text-orange-600",
  critical: "bg-red-50 text-red-600",
};

const statusColors: Record<string, string> = {
  open: "bg-red-50 text-red-600",
  investigating: "bg-amber-50 text-amber-600",
  contained: "bg-blue-50 text-blue-600",
  eradicated: "bg-emerald-50 text-emerald-600",
  closed: "bg-zinc-100 text-zinc-500",
};

function IncidentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState(searchParams.get("severity") || "all");
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [owner, setOwner] = useState<"any" | "me">("any");
  const [sort, setSort] = useState<IncidentFilterParams["sort"]>("created_desc");
  const riskParam = searchParams.get("risk");

  // Bulk operations state
  const [selectedIncidents, setSelectedIncidents] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkTagName, setBulkTagName] = useState("");
  const [applyingBulkTag, setApplyingBulkTag] = useState(false);
  const [availableTags, setAvailableTags] = useState<IncidentTag[]>([]);

  const fetchIncidents = useCallback(
    async (params: IncidentFilterParams = {}, riskFilter?: string | null) => {
      try {
        setSearching(true);
        let data = await listIncidentsAdvanced(params);

        // Client-side risk filtering
        if (riskFilter) {
          const now = new Date();
          const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          data = data.filter((inc) => {
            if (inc.status === "closed") return false;
            if (riskFilter === "overdue") {
              return inc.due_at && new Date(inc.due_at).getTime() < now.getTime();
            } else if (riskFilter === "duesoon") {
              return inc.due_at && new Date(inc.due_at).getTime() >= now.getTime() && new Date(inc.due_at).getTime() < in24h.getTime();
            } else if (riskFilter === "ontrack") {
              return !inc.due_at || new Date(inc.due_at).getTime() >= in24h.getTime();
            }
            return true;
          });
        }

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
        
        // Fetch tags for bulk operations
        listTags().then(setAvailableTags).catch(() => {});
        
        // Auto-apply filters from URL params
        await fetchIncidents(
          { 
            severity: severity !== "all" ? severity : undefined,
            status: riskParam ? undefined : (status !== "all" ? status : undefined),
            owner,
            sort 
          },
          riskParam
        );
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router, fetchIncidents, severity, status, owner, sort]);

  function handleApplyFilters() {
    setError(null);
    fetchIncidents({ q: q || undefined, severity, status, owner, sort }, riskParam);
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

  function toggleIncidentSelection(incidentId: string) {
    const newSelected = new Set(selectedIncidents);
    if (newSelected.has(incidentId)) {
      newSelected.delete(incidentId);
    } else {
      newSelected.add(incidentId);
    }
    setSelectedIncidents(newSelected);
  }

  function toggleSelectAll() {
    if (selectedIncidents.size === incidents.length) {
      setSelectedIncidents(new Set());
    } else {
      setSelectedIncidents(new Set(incidents.map(i => i.id)));
    }
  }

  async function handleBulkAddTag() {
    if (!bulkTagName.trim() || selectedIncidents.size === 0) return;
    setApplyingBulkTag(true);
    setError(null);
    try {
      const tag = await getOrCreateTag(bulkTagName.trim());
      await bulkAddTagToIncidents({ incidentIds: Array.from(selectedIncidents), tagId: tag.id });
      setBulkTagName("");
      setSelectedIncidents(new Set());
      setShowBulkActions(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to apply bulk tag");
    } finally {
      setApplyingBulkTag(false);
    }
  }

  if (loading) {
    return (
      <AppShell title="Incidents" subtitle="Loading...">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-white px-5 py-4 shadow-sm animate-pulse">
              <div className="h-4 w-48 rounded bg-zinc-200" />
              <div className="mt-2 h-3 w-32 rounded bg-zinc-100" />
            </div>
          ))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Incidents"
      subtitle={activeOrg ? activeOrg.name : "Incident Tracker"}
      actionLabel="New Incident"
      actionHref="/incidents/new"
      showAction={myRole !== null && myRole !== "viewer"}
    >
      {/* Active risk filter banner */}
      {riskParam && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5">
          <span className="text-sm text-amber-700 font-medium">
            Showing: {riskParam === "ontrack" ? "On Track" : riskParam === "duesoon" ? "Due Soon" : riskParam === "overdue" ? "Overdue" : riskParam} incidents
          </span>
          <Link
            href="/incidents"
            className="ml-auto rounded-lg bg-white border border-amber-200 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 transition"
          >
            Clear Filter
          </Link>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Search */}
          <div className="sm:col-span-2 lg:col-span-3">
            <input
              type="text"
              placeholder="Search title or summary..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
              className="block w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Severity */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Severity
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
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
            <label className="mb-1 block text-xs font-medium text-muted">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
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
            <label className="mb-1 block text-xs font-medium text-muted">
              Owner
            </label>
            <select
              value={owner}
              onChange={(e) => setOwner(e.target.value as "any" | "me")}
              className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
            >
              <option value="any">Anyone</option>
              <option value="me">My Incidents</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Sort
            </label>
            <select
              value={sort}
              onChange={(e) =>
                setSort(e.target.value as IncidentFilterParams["sort"])
              }
              className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
            >
              <option value="created_desc">Newest First</option>
              <option value="updated_desc">Recently Updated</option>
              <option value="severity_desc">Severity (High to Low)</option>
            </select>
          </div>

          {/* Buttons */}
          <div className="flex items-end gap-2">
            <button
              onClick={handleApplyFilters}
              disabled={searching}
              className="rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {searching ? "Searching..." : "Apply"}
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

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Bulk Operations */}
      {myRole && myRole !== "viewer" && incidents.length > 0 && (
        <div className="mb-6 rounded-2xl bg-white shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedIncidents.size === incidents.length && incidents.length > 0}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
              />
              <span className="text-sm font-medium text-foreground">
                {selectedIncidents.size} selected
              </span>
            </div>
            {selectedIncidents.size > 0 && (
              <button
                onClick={() => setShowBulkActions(!showBulkActions)}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
              >
                {showBulkActions ? "Cancel" : "Bulk Actions"}
              </button>
            )}
          </div>

          {showBulkActions && selectedIncidents.size > 0 && (
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-sm font-medium text-foreground mb-3">Add Tag to Selected Incidents</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={bulkTagName}
                  onChange={(e) => setBulkTagName(e.target.value)}
                  placeholder="Tag name (e.g. reviewed, escalated)"
                  className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none"
                />
                <button
                  onClick={handleBulkAddTag}
                  disabled={applyingBulkTag || !bulkTagName.trim()}
                  className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {applyingBulkTag ? "Applying..." : "Apply Tag"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Incidents List */}
      {incidents.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-sm border border-dashed border-border py-16 text-center">
          <p className="text-muted">
            No incidents found. Try adjusting your filters.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
          {incidents.map((incident, idx) => (
            <div
              key={incident.id}
              className={`flex items-center gap-3 px-5 py-4 transition hover:bg-card-hover ${
                idx !== 0 ? "border-t border-border" : ""
              }`}
            >
              {myRole && myRole !== "viewer" && (
                <input
                  type="checkbox"
                  checked={selectedIncidents.has(incident.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleIncidentSelection(incident.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                />
              )}
              <Link
                href={`/incidents/${incident.id}`}
                className="flex-1 min-w-0"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold text-foreground truncate">
                      {incident.title}
                    </h2>
                    <p className="mt-1 text-xs text-muted">
                      {new Date(incident.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        severityColors[incident.severity] ||
                        "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {incident.severity}
                    </span>
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        statusColors[incident.status] ||
                        "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {incident.status}
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

export default function IncidentsPage() {
  return (
    <React.Suspense fallback={
      <AppShell title="Incidents" subtitle="Loading...">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-white px-5 py-4 shadow-sm animate-pulse">
              <div className="h-4 w-48 rounded bg-zinc-200" />
              <div className="mt-2 h-3 w-32 rounded bg-zinc-100" />
            </div>
          ))}
        </div>
      </AppShell>
    }>
      <IncidentsPageContent />
    </React.Suspense>
  );
}
