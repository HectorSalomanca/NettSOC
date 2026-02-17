import { supabase } from "@/lib/supabaseClient";
import { getActiveOrg } from "@/services/org";
import { logAudit } from "@/services/audit";

export interface Incident {
  id: string;
  title: string;
  summary: string;
  severity: string;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  org_id: string;
  assigned_to?: string | null;
  due_at?: string | null;
  closed_at?: string | null;
}

export async function listIncidents(): Promise<Incident[]> {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("No active organization");

  const { data, error } = await supabase
    .from("incidents")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Incident[];
}

export async function getIncidentById(id: string): Promise<Incident> {
  const { data, error } = await supabase
    .from("incidents")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Incident;
}

export async function createIncident(incident: {
  title: string;
  summary: string;
  severity: string;
  status: string;
  assigned_to?: string | null;
}): Promise<Incident> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const orgId = getActiveOrg();
  if (!orgId) throw new Error("No active organization");

  const { data, error } = await supabase
    .from("incidents")
    .insert({
      ...incident,
      created_by: session.user.id,
      org_id: orgId,
    })
    .select()
    .single();
  if (error) throw error;
  
  await logAudit({
    action: "create",
    entity_type: "incident",
    entity_id: data.id,
    details: { title: incident.title, severity: incident.severity, status: incident.status },
  });
  
  return data as Incident;
}

export async function updateIncident(
  id: string,
  patch: Partial<Pick<Incident, "summary" | "severity" | "status" | "assigned_to" | "due_at">>
): Promise<Incident> {
  // Set closed_at only on first transition to closed
  const updatePayload: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
  if (patch.status === "closed") {
    // Only set closed_at if it hasn't been set before
    const { data: current } = await supabase.from("incidents").select("closed_at").eq("id", id).single();
    if (!current?.closed_at) {
      updatePayload.closed_at = new Date().toISOString();
    }
  }

  const { data, error } = await supabase
    .from("incidents")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  
  await logAudit({
    action: "update",
    entity_type: "incident",
    entity_id: id,
    details: { changes: patch },
  });
  
  return data as Incident;
}

export async function deleteIncident(id: string): Promise<void> {
  const { error } = await supabase.from("incidents").delete().eq("id", id);
  if (error) throw error;
  
  await logAudit({
    action: "delete",
    entity_type: "incident",
    entity_id: id,
  });
}

export interface IncidentFilterParams {
  q?: string;
  severity?: string;
  status?: string;
  owner?: "me" | "any";
  sort?: "updated_desc" | "created_desc" | "severity_desc";
  limit?: number;
}

export async function listIncidentsAdvanced(
  params: IncidentFilterParams = {}
): Promise<Incident[]> {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("No active organization");

  let query = supabase.from("incidents").select("*").eq("org_id", orgId);

  if (params.q) {
    query = query.or(
      `title.ilike.%${params.q}%,summary.ilike.%${params.q}%`
    );
  }

  if (params.severity && params.severity !== "all") {
    query = query.eq("severity", params.severity);
  }

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  if (params.owner === "me") {
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      query = query.eq("created_by", userData.user.id);
    }
  }

  if (params.sort === "updated_desc") {
    query = query.order("updated_at", { ascending: false, nullsFirst: false });
  } else if (params.sort === "severity_desc") {
    query = query.order("severity", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  if (params.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Incident[];
}

export interface DashboardStats {
  statusCounts: Record<string, number>;
  severityCounts: Record<string, number>;
  criticalOpen: Incident[];
  recentlyUpdated: Incident[];
  assignedToMe: Incident[];
  unassigned: Incident[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("No active organization");

  const { data: allIncidents, error } = await supabase
    .from("incidents")
    .select("*")
    .eq("org_id", orgId);
  if (error) throw error;

  const incidents = allIncidents as Incident[];

  const statusCounts: Record<string, number> = {
    open: 0,
    investigating: 0,
    contained: 0,
    eradicated: 0,
    closed: 0,
  };
  const severityCounts: Record<string, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  for (const inc of incidents) {
    if (inc.status in statusCounts) statusCounts[inc.status]++;
    if (inc.severity in severityCounts) severityCounts[inc.severity]++;
  }

  const criticalOpen = incidents
    .filter((i) => i.severity === "critical" && i.status === "open")
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 5);

  const recentlyUpdated = [...incidents]
    .sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at).getTime() -
        new Date(a.updated_at || a.created_at).getTime()
    )
    .slice(0, 5);

  const { data: userData } = await supabase.auth.getUser();
  const currentUserId = userData?.user?.id;

  const assignedToMe = currentUserId
    ? incidents
        .filter((i) => i.assigned_to === currentUserId && i.status !== "closed")
        .sort((a, b) => {
          // Sort by due_at first (soonest first), then by created_at
          if (a.due_at && b.due_at) {
            return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
          }
          if (a.due_at) return -1;
          if (b.due_at) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        })
        .slice(0, 5)
    : [];

  const unassigned = incidents
    .filter((i) => !i.assigned_to && i.status !== "closed")
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 5);

  return { statusCounts, severityCounts, criticalOpen, recentlyUpdated, assignedToMe, unassigned };
}

// --- Operational Risk ---

export interface OperationalRiskStats {
  onTrack: number;
  dueSoon: number;
  overdue: number;
  total: number;
}

export async function getOperationalRiskStats(): Promise<OperationalRiskStats> {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("No active organization");

  const { data, error } = await supabase
    .from("incidents")
    .select("id, status, due_at")
    .eq("org_id", orgId)
    .neq("status", "closed");
  if (error) throw error;

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  let onTrack = 0;
  let dueSoon = 0;
  let overdue = 0;

  for (const inc of data) {
    if (!inc.due_at) {
      onTrack++;
    } else {
      const due = new Date(inc.due_at);
      if (due.getTime() < now.getTime()) {
        overdue++;
      } else if (due.getTime() < in24h.getTime()) {
        dueSoon++;
      } else {
        onTrack++;
      }
    }
  }

  return { onTrack, dueSoon, overdue, total: data.length };
}

// --- MTTR (Mean Time To Resolve) ---

export interface MttrStats {
  medianHours: number | null;
  p90Hours: number | null;
  count: number;
}

export async function getMttrStats(): Promise<MttrStats> {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("No active organization");

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("incidents")
    .select("created_at, closed_at")
    .eq("org_id", orgId)
    .eq("status", "closed")
    .not("closed_at", "is", null)
    .gte("closed_at", thirtyDaysAgo);
  if (error) throw error;

  if (!data || data.length === 0) {
    return { medianHours: null, p90Hours: null, count: 0 };
  }

  const resolveTimesMs = data
    .map((inc) => new Date(inc.closed_at).getTime() - new Date(inc.created_at).getTime())
    .filter((ms) => ms > 0)
    .sort((a, b) => a - b);

  if (resolveTimesMs.length === 0) {
    return { medianHours: null, p90Hours: null, count: 0 };
  }

  const median = resolveTimesMs[Math.floor(resolveTimesMs.length / 2)];
  const p90Idx = Math.min(Math.ceil(resolveTimesMs.length * 0.9) - 1, resolveTimesMs.length - 1);
  const p90 = resolveTimesMs[p90Idx];

  const msToHours = (ms: number) => Math.round((ms / (1000 * 60 * 60)) * 10) / 10;

  return {
    medianHours: msToHours(median),
    p90Hours: msToHours(p90),
    count: resolveTimesMs.length,
  };
}
