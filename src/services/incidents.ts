import { supabase } from "@/lib/supabaseClient";
import { getActiveOrg } from "@/services/org";

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
  return data as Incident;
}

export async function updateIncident(
  id: string,
  patch: Partial<Pick<Incident, "summary" | "severity" | "status">>
): Promise<Incident> {
  const { data, error } = await supabase
    .from("incidents")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Incident;
}

export async function deleteIncident(id: string): Promise<void> {
  const { error } = await supabase.from("incidents").delete().eq("id", id);
  if (error) throw error;
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

  return { statusCounts, severityCounts, criticalOpen, recentlyUpdated };
}
