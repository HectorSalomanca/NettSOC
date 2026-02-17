"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/services/auth";
import {
  getDashboardStats,
  DashboardStats,
  Incident,
  getOperationalRiskStats,
  OperationalRiskStats,
} from "@/services/incidents";
import { getActiveOrgDetails, Organization } from "@/services/org";
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

const kpiAccents: Record<string, { bg: string; text: string; bar: string }> = {
  total: { bg: "bg-gradient-to-br from-rose-400 to-pink-500", text: "text-white", bar: "bg-white/30" },
  open: { bg: "bg-white", text: "text-foreground", bar: "bg-red-400" },
  critical: { bg: "bg-white", text: "text-foreground", bar: "bg-orange-400" },
  investigating: { bg: "bg-white", text: "text-foreground", bar: "bg-amber-400" },
  closed: { bg: "bg-white", text: "text-foreground", bar: "bg-zinc-300" },
};

function KpiCard({
  label,
  count,
  accent,
  href,
}: {
  label: string;
  count: number;
  accent: string;
  href?: string;
}) {
  const style = kpiAccents[accent] || kpiAccents.total;
  const content = (
    <div className={`rounded-2xl ${style.bg} p-5 shadow-sm transition hover:shadow-md h-full`}>
      <p className={`text-sm font-medium ${style.text === "text-white" ? "text-white/80" : "text-muted"}`}>
        {label}
      </p>
      <p className={`mt-2 text-3xl font-bold ${style.text}`}>{count}</p>
      <div className={`mt-3 h-1 w-12 rounded-full ${style.bar}`} />
    </div>
  );

  if (href) {
    return <Link href={href} className="block">{content}</Link>;
  }
  return content;
}

function IncidentRow({ incident }: { incident: Incident }) {
  return (
    <Link
      href={`/incidents/${incident.id}`}
      className="flex items-center justify-between rounded-xl bg-white px-4 py-3.5 transition hover:bg-card-hover shadow-sm"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {incident.title}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {new Date(
            incident.updated_at || incident.created_at
          ).toLocaleString()}
        </p>
      </div>
      <div className="ml-3 flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            severityColors[incident.severity] || "bg-zinc-100 text-zinc-500"
          }`}
        >
          {incident.severity}
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            statusColors[incident.status] || "bg-zinc-100 text-zinc-500"
          }`}
        >
          {incident.status}
        </span>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm animate-pulse">
      <div className="h-3 w-16 rounded bg-zinc-200" />
      <div className="mt-3 h-7 w-12 rounded bg-zinc-200" />
      <div className="mt-3 h-1 w-12 rounded bg-zinc-100" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="rounded-xl bg-white px-4 py-3.5 shadow-sm animate-pulse">
      <div className="h-4 w-48 rounded bg-zinc-200" />
      <div className="mt-2 h-3 w-32 rounded bg-zinc-100" />
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [risk, setRisk] = useState<OperationalRiskStats | null>(null);
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
        const [dashStats, riskStats] = await Promise.all([
          getDashboardStats(),
          getOperationalRiskStats(),
        ]);
        setStats(dashStats);
        setRisk(riskStats);
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

  const totalIncidents =
    stats
      ? Object.values(stats.statusCounts).reduce((a, b) => a + b, 0)
      : 0;

  return (
    <AppShell
      title="Dashboard"
      subtitle={activeOrg ? activeOrg.name : "NettSOC"}
      actionLabel="New Incident"
      actionHref="/incidents/new"
      showAction
    >
      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 mb-8">
            {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2">{[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}</div>
            <div className="space-y-2">{[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}</div>
          </div>
        </>
      ) : stats && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 mb-8">
            <KpiCard
              label="Total Incidents"
              count={totalIncidents}
              accent="total"
              href="/incidents"
            />
            <KpiCard
              label="Open"
              count={stats.statusCounts.open}
              accent="open"
              href="/incidents?status=open"
            />
            <KpiCard
              label="Critical"
              count={stats.severityCounts.critical}
              accent="critical"
              href="/incidents?severity=critical"
            />
            <KpiCard
              label="Investigating"
              count={stats.statusCounts.investigating}
              accent="investigating"
              href="/incidents?status=investigating"
            />
            <KpiCard
              label="Closed"
              count={stats.statusCounts.closed}
              accent="closed"
              href="/incidents?status=closed"
            />
          </div>

          {/* Row 2: Severity Breakdown + Chart Placeholder */}
          <div className="grid gap-6 lg:grid-cols-3 mb-8">
            {/* Severity Breakdown */}
            <div className="lg:col-span-2 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-foreground mb-4">
                Severity Breakdown
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(["low", "medium", "high", "critical"] as const).map(
                  (sev) => (
                    <Link
                      key={sev}
                      href={`/incidents?severity=${sev}`}
                      className={`rounded-xl px-4 py-3 text-center transition hover:opacity-80 ${
                        severityColors[sev]
                      }`}
                    >
                      <p className="text-xs font-medium uppercase tracking-wide">{sev}</p>
                      <p className="mt-1 text-2xl font-bold">
                        {stats.severityCounts[sev]}
                      </p>
                    </Link>
                  )
                )}
              </div>
            </div>

            {/* Operational Risk */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-foreground mb-4">
                Operational Risk
              </h2>
              {risk && risk.total > 0 ? (
                <>
                  {/* Segmented progress bar */}
                  <div className="flex h-4 w-full overflow-hidden rounded-full bg-zinc-100">
                    {risk.onTrack > 0 && (
                      <Link
                        href="/incidents?risk=ontrack"
                        title={`On Track: ${risk.onTrack}`}
                        className="bg-emerald-400 transition-all hover:brightness-110"
                        style={{ width: `${(risk.onTrack / risk.total) * 100}%` }}
                      />
                    )}
                    {risk.dueSoon > 0 && (
                      <Link
                        href="/incidents?risk=duesoon"
                        title={`Due Soon: ${risk.dueSoon}`}
                        className="bg-amber-400 transition-all hover:brightness-110"
                        style={{ width: `${(risk.dueSoon / risk.total) * 100}%` }}
                      />
                    )}
                    {risk.overdue > 0 && (
                      <Link
                        href="/incidents?risk=overdue"
                        title={`Overdue: ${risk.overdue}`}
                        className="bg-red-400 transition-all hover:brightness-110"
                        style={{ width: `${(risk.overdue / risk.total) * 100}%` }}
                      />
                    )}
                  </div>

                  {/* Legend */}
                  <div className="mt-4 space-y-2">
                    <Link href="/incidents?risk=ontrack" className="flex items-center justify-between text-sm hover:bg-background rounded-lg px-2 py-1 -mx-2 transition">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                        <span className="text-foreground">On Track</span>
                      </span>
                      <span className="font-semibold text-foreground">
                        {risk.onTrack}
                        <span className="ml-1 text-xs font-normal text-muted">
                          ({risk.total > 0 ? Math.round((risk.onTrack / risk.total) * 100) : 0}%)
                        </span>
                      </span>
                    </Link>
                    <Link href="/incidents?risk=duesoon" className="flex items-center justify-between text-sm hover:bg-background rounded-lg px-2 py-1 -mx-2 transition">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                        <span className="text-foreground">Due Soon</span>
                      </span>
                      <span className="font-semibold text-foreground">
                        {risk.dueSoon}
                        <span className="ml-1 text-xs font-normal text-muted">
                          ({risk.total > 0 ? Math.round((risk.dueSoon / risk.total) * 100) : 0}%)
                        </span>
                      </span>
                    </Link>
                    <Link href="/incidents?risk=overdue" className="flex items-center justify-between text-sm hover:bg-background rounded-lg px-2 py-1 -mx-2 transition">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                        <span className="text-foreground">Overdue</span>
                      </span>
                      <span className="font-semibold text-foreground">
                        {risk.overdue}
                        <span className="ml-1 text-xs font-normal text-muted">
                          ({risk.total > 0 ? Math.round((risk.overdue / risk.total) * 100) : 0}%)
                        </span>
                      </span>
                    </Link>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-border py-6 text-center">
                  <p className="text-muted text-sm">No open incidents</p>
                </div>
              )}
            </div>
          </div>

          {/* Row 3: Two-column lists */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Critical Open OR Assigned to Me OR Unassigned */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              {stats.criticalOpen.length > 0 ? (
                <>
                  <h2 className="text-base font-semibold text-foreground mb-4">
                    Critical &amp; Open
                  </h2>
                  <div className="space-y-2">
                    {stats.criticalOpen.map((inc) => (
                      <IncidentRow key={inc.id} incident={inc} />
                    ))}
                  </div>
                </>
              ) : stats.assignedToMe.length > 0 ? (
                <>
                  <h2 className="text-base font-semibold text-foreground mb-4">
                    Assigned to Me
                  </h2>
                  <div className="space-y-2">
                    {stats.assignedToMe.map((inc) => (
                      <Link
                        key={inc.id}
                        href={`/incidents/${inc.id}`}
                        className="flex items-center justify-between rounded-xl bg-background px-4 py-3 transition hover:bg-card-hover"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {inc.title}
                          </p>
                          <p className="mt-0.5 text-xs text-muted">
                            {inc.due_at ? (
                              <>
                                <span className="font-bold text-amber-600">
                                  Due: {new Date(inc.due_at).toLocaleString()}
                                </span>
                                {" · "}
                              </>
                            ) : null}
                            {new Date(inc.updated_at || inc.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="ml-3 flex items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              severityColors[inc.severity] || "bg-zinc-100 text-zinc-500"
                            }`}
                          >
                            {inc.severity}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              statusColors[inc.status] || "bg-zinc-100 text-zinc-500"
                            }`}
                          >
                            {inc.status}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              ) : stats.unassigned.length > 0 ? (
                <>
                  <h2 className="text-base font-semibold text-foreground mb-4">
                    Unassigned Incidents
                  </h2>
                  <div className="space-y-2">
                    {stats.unassigned.map((inc) => (
                      <IncidentRow key={inc.id} incident={inc} />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-base font-semibold text-foreground mb-4">
                    Critical &amp; Open
                  </h2>
                  <div className="rounded-xl border border-dashed border-border py-8 text-center">
                    <p className="text-muted text-sm">
                      No critical open incidents
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Recently Updated */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-foreground mb-4">
                Recently Updated
              </h2>
              {stats.recentlyUpdated.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-8 text-center">
                  <p className="text-muted text-sm">No incidents yet</p>
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
    </AppShell>
  );
}
