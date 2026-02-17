"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/services/auth";
import { getActiveOrgDetails, Organization } from "@/services/org";
import { listIOCs, createIOC, updateIOC, deleteIOC, validateIOC, exportIOCsToCSV, getThreatIntelURLs, IOC } from "@/services/iocs";
import { getMyRoleInActiveOrg } from "@/services/members";
import AppShell from "@/components/AppShell";

export default function IOCsPage() {
  const router = useRouter();
  const [iocs, setIOCs] = useState<IOC[]>([]);
  const [filteredIOCs, setFilteredIOCs] = useState<IOC[]>([]);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState("all");
  const [threatFilter, setThreatFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Add form state
  const [newType, setNewType] = useState<"ip" | "domain" | "hash" | "url" | "email">("ip");
  const [newValue, setNewValue] = useState("");
  const [newThreatScore, setNewThreatScore] = useState<"benign" | "suspicious" | "malicious" | "unknown">("unknown");
  const [newSource, setNewSource] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const isAnalyst = myRole === "admin" || myRole === "analyst";

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

        const iocsList = await listIOCs();
        setIOCs(iocsList);
        setFilteredIOCs(iocsList);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load IOCs");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  useEffect(() => {
    let filtered = [...iocs];

    if (typeFilter !== "all") {
      filtered = filtered.filter(ioc => ioc.type === typeFilter);
    }

    if (threatFilter !== "all") {
      filtered = filtered.filter(ioc => ioc.threat_score === threatFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(ioc => 
        ioc.value.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredIOCs(filtered);
  }, [iocs, typeFilter, threatFilter, searchQuery]);

  async function handleAddIOC(e: React.FormEvent) {
    e.preventDefault();
    if (!newValue.trim()) return;

    // Validate IOC format
    const validation = validateIOC(newType, newValue.trim());
    if (!validation.valid) {
      setValidationError(validation.error || "Invalid IOC format");
      return;
    }

    setAdding(true);
    setError(null);
    setValidationError(null);
    try {
      await createIOC({
        type: newType,
        value: newValue.trim(),
        threat_score: newThreatScore,
        source: newSource.trim() || undefined,
        notes: newNotes.trim() || undefined,
      });

      // Refresh list
      const iocsList = await listIOCs();
      setIOCs(iocsList);

      // Reset form
      setNewValue("");
      setNewThreatScore("unknown");
      setNewSource("");
      setNewNotes("");
      setShowAddForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add IOC");
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteIOC(iocId: string) {
    if (!confirm("Are you sure you want to delete this IOC?")) return;

    try {
      await deleteIOC(iocId);
      const iocsList = await listIOCs();
      setIOCs(iocsList);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete IOC");
    }
  }

  function handleExportCSV() {
    const csv = exportIOCsToCSV(filteredIOCs);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `iocs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  const threatScoreColors: Record<string, string> = {
    benign: "bg-emerald-50 text-emerald-600",
    suspicious: "bg-amber-50 text-amber-600",
    malicious: "bg-red-50 text-red-600",
    unknown: "bg-zinc-100 text-zinc-500",
  };

  const typeColors: Record<string, string> = {
    ip: "bg-blue-50 text-blue-600",
    domain: "bg-purple-50 text-purple-600",
    hash: "bg-orange-50 text-orange-600",
    url: "bg-cyan-50 text-cyan-600",
    email: "bg-pink-50 text-pink-600",
  };

  if (loading) {
    return (
      <AppShell title="IOCs" subtitle="Loading...">
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
    <AppShell title="Indicators of Compromise" subtitle={activeOrg ? activeOrg.name : "IOC Management"}>
      {error && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Actions Bar */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {isAnalyst && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {showAddForm ? "Cancel" : "+ Add IOC"}
            </button>
          )}
          {filteredIOCs.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-background"
            >
              Export CSV
            </button>
          )}
        </div>
        <div className="text-sm text-muted">
          {filteredIOCs.length} IOC{filteredIOCs.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Add IOC Form */}
      {showAddForm && (
        <div className="mb-6 rounded-2xl bg-white shadow-sm p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Add IOC</h2>
          {validationError && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {validationError}
            </div>
          )}
          <form onSubmit={handleAddIOC} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Type *
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
                >
                  <option value="ip">IP Address</option>
                  <option value="domain">Domain</option>
                  <option value="hash">File Hash</option>
                  <option value="url">URL</option>
                  <option value="email">Email</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Value *
                </label>
                <input
                  type="text"
                  required
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={
                    newType === "ip" ? "e.g. 192.168.1.100" :
                    newType === "domain" ? "e.g. malicious.com" :
                    newType === "hash" ? "e.g. d41d8cd98f00b204e9800998ecf8427e" :
                    newType === "url" ? "e.g. https://malicious.com/path" :
                    "e.g. attacker@example.com"
                  }
                  className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Threat Score
                </label>
                <select
                  value={newThreatScore}
                  onChange={(e) => setNewThreatScore(e.target.value as any)}
                  className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
                >
                  <option value="unknown">Unknown</option>
                  <option value="benign">Benign</option>
                  <option value="suspicious">Suspicious</option>
                  <option value="malicious">Malicious</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Source
                </label>
                <input
                  type="text"
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value)}
                  placeholder="e.g. Firewall logs, Email gateway"
                  className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Notes
              </label>
              <textarea
                rows={2}
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Additional context..."
                className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none resize-y"
              />
            </div>

            <button
              type="submit"
              disabled={adding || !newValue.trim()}
              className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {adding ? "Adding..." : "Add IOC"}
            </button>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="ip">IP Address</option>
              <option value="domain">Domain</option>
              <option value="hash">File Hash</option>
              <option value="url">URL</option>
              <option value="email">Email</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Threat Score</label>
            <select
              value={threatFilter}
              onChange={(e) => setThreatFilter(e.target.value)}
              className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
            >
              <option value="all">All Scores</option>
              <option value="malicious">Malicious</option>
              <option value="suspicious">Suspicious</option>
              <option value="benign">Benign</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search IOC value..."
              className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* IOCs List */}
      {filteredIOCs.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-sm border border-dashed border-border py-16 text-center">
          <p className="text-muted">
            {iocs.length === 0 ? "No IOCs yet" : "No IOCs match your filters"}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
          {filteredIOCs.map((ioc, idx) => (
            <div
              key={ioc.id}
              className={`px-5 py-4 transition hover:bg-card-hover ${
                idx !== 0 ? "border-t border-border" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[ioc.type]}`}>
                      {ioc.type}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${threatScoreColors[ioc.threat_score]}`}>
                      {ioc.threat_score}
                    </span>
                  </div>
                  <p className="text-sm font-mono font-medium text-foreground break-all">
                    {ioc.value}
                  </p>
                  {ioc.notes && (
                    <p className="mt-1 text-xs text-muted">{ioc.notes}</p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted">
                    <span>First seen: {new Date(ioc.first_seen).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>Last seen: {new Date(ioc.last_seen).toLocaleDateString()}</span>
                    {ioc.source && (
                      <>
                        <span>•</span>
                        <span>Source: {ioc.source}</span>
                      </>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {getThreatIntelURLs(ioc).map((link) => (
                      <a
                        key={link.name}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent hover:underline"
                      >
                        {link.name} →
                      </a>
                    ))}
                  </div>
                </div>
                {isAnalyst && (
                  <button
                    onClick={() => handleDeleteIOC(ioc.id)}
                    className="shrink-0 text-xs text-red-500 hover:text-red-400 transition"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
