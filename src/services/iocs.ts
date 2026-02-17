import { supabase } from "@/lib/supabaseClient";
import { getActiveOrg } from "@/services/org";
import { logActivity } from "@/services/activity";

export interface IOC {
  id: string;
  org_id: string;
  type: "ip" | "domain" | "hash" | "url" | "email";
  value: string;
  threat_score: "benign" | "suspicious" | "malicious" | "unknown";
  first_seen: string;
  last_seen: string;
  source: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface IncidentIOC {
  id: string;
  incident_id: string;
  ioc_id: string;
  context: string | null;
  added_by: string;
  added_at: string;
}

export interface IOCWithIncidentCount extends IOC {
  incident_count: number;
}

// List all IOCs for the active org
export async function listIOCs(filters?: {
  type?: string;
  threat_score?: string;
  search?: string;
}): Promise<IOC[]> {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("No active organization");

  let query = supabase
    .from("iocs")
    .select("*")
    .eq("org_id", orgId)
    .order("last_seen", { ascending: false });

  if (filters?.type) {
    query = query.eq("type", filters.type);
  }

  if (filters?.threat_score) {
    query = query.eq("threat_score", filters.threat_score);
  }

  if (filters?.search) {
    query = query.ilike("value", `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as IOC[];
}

// Get a single IOC
export async function getIOC(iocId: string): Promise<IOC> {
  const { data, error } = await supabase
    .from("iocs")
    .select("*")
    .eq("id", iocId)
    .single();

  if (error) throw error;
  return data as IOC;
}

// Create a new IOC
export async function createIOC(params: {
  type: "ip" | "domain" | "hash" | "url" | "email";
  value: string;
  threat_score?: "benign" | "suspicious" | "malicious" | "unknown";
  source?: string;
  notes?: string;
}): Promise<IOC> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) throw new Error("Not authenticated");

  const orgId = getActiveOrg();
  if (!orgId) throw new Error("No active organization");

  // Check if IOC already exists
  const { data: existing } = await supabase
    .from("iocs")
    .select("*")
    .eq("org_id", orgId)
    .eq("type", params.type)
    .eq("value", params.value)
    .single();

  if (existing) {
    // Update last_seen
    const { data, error } = await supabase
      .from("iocs")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) throw error;
    return data as IOC;
  }

  // Create new IOC
  const { data, error } = await supabase
    .from("iocs")
    .insert({
      org_id: orgId,
      type: params.type,
      value: params.value,
      threat_score: params.threat_score || "unknown",
      source: params.source || null,
      notes: params.notes || null,
      created_by: userData.user.id,
    })
    .select()
    .single();

  if (error) throw error;

  await logActivity({
    action: "created",
    entityType: "ioc",
    entityId: data.id,
    entityTitle: `${params.type}: ${params.value}`,
  });

  return data as IOC;
}

// Update an IOC
export async function updateIOC(
  iocId: string,
  params: Partial<Pick<IOC, "threat_score" | "source" | "notes">>
): Promise<IOC> {
  const { data, error } = await supabase
    .from("iocs")
    .update({ ...params, updated_at: new Date().toISOString() })
    .eq("id", iocId)
    .select()
    .single();

  if (error) throw error;
  return data as IOC;
}

// Delete an IOC
export async function deleteIOC(iocId: string): Promise<void> {
  const { error } = await supabase
    .from("iocs")
    .delete()
    .eq("id", iocId);

  if (error) throw error;
}

// Link IOC to incident
export async function linkIOCToIncident(params: {
  incidentId: string;
  iocId: string;
  context?: string;
  incidentTitle?: string;
}): Promise<IncidentIOC> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("incident_iocs")
    .insert({
      incident_id: params.incidentId,
      ioc_id: params.iocId,
      context: params.context || null,
      added_by: userData.user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.message.includes("duplicate")) {
      // Already linked, fetch existing record
      const { data: existing } = await supabase
        .from("incident_iocs")
        .select("*")
        .eq("incident_id", params.incidentId)
        .eq("ioc_id", params.iocId)
        .single();
      return existing as IncidentIOC;
    }
    throw error;
  }

  // Update IOC last_seen
  await supabase
    .from("iocs")
    .update({ last_seen: new Date().toISOString() })
    .eq("id", params.iocId);

  // Log activity
  const { data: ioc } = await supabase
    .from("iocs")
    .select("type, value")
    .eq("id", params.iocId)
    .single();

  await logActivity({
    action: "linked IOC",
    entityType: "incident",
    entityId: params.incidentId,
    entityTitle: params.incidentTitle,
    details: { ioc: `${ioc?.type}: ${ioc?.value}` },
  });

  return data as IncidentIOC;
}

// Unlink IOC from incident
export async function unlinkIOCFromIncident(params: {
  incidentId: string;
  iocId: string;
}): Promise<void> {
  const { error } = await supabase
    .from("incident_iocs")
    .delete()
    .eq("incident_id", params.incidentId)
    .eq("ioc_id", params.iocId);

  if (error) throw error;
}

// Get IOCs for an incident
export async function getIncidentIOCs(incidentId: string): Promise<IOC[]> {
  const { data, error } = await supabase
    .from("incident_iocs")
    .select("ioc_id, iocs(*)")
    .eq("incident_id", incidentId);

  if (error) throw error;
  return (data || []).map((item: any) => item.iocs).filter(Boolean) as IOC[];
}

// Get incidents for an IOC
export async function getIOCIncidents(iocId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("incident_iocs")
    .select("incident_id")
    .eq("ioc_id", iocId);

  if (error) throw error;
  return (data || []).map((item: any) => item.incident_id);
}

// Search for IOCs across all incidents
export async function searchIOCsInIncidents(searchValue: string): Promise<{
  ioc: IOC;
  incidents: string[];
}[]> {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("No active organization");

  const { data: iocs, error: iocsError } = await supabase
    .from("iocs")
    .select("*")
    .eq("org_id", orgId)
    .ilike("value", `%${searchValue}%`);

  if (iocsError) throw iocsError;
  if (!iocs || iocs.length === 0) return [];

  const results = [];
  for (const ioc of iocs) {
    const incidents = await getIOCIncidents(ioc.id);
    results.push({ ioc: ioc as IOC, incidents });
  }

  return results;
}

// Validate IOC format
export function validateIOC(type: string, value: string): { valid: boolean; error?: string } {
  switch (type) {
    case "ip":
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(value)) {
        return { valid: false, error: "Invalid IP address format" };
      }
      break;
    case "domain":
      const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
      if (!domainRegex.test(value)) {
        return { valid: false, error: "Invalid domain format" };
      }
      break;
    case "hash":
      const md5Regex = /^[a-f0-9]{32}$/i;
      const sha1Regex = /^[a-f0-9]{40}$/i;
      const sha256Regex = /^[a-f0-9]{64}$/i;
      if (!md5Regex.test(value) && !sha1Regex.test(value) && !sha256Regex.test(value)) {
        return { valid: false, error: "Invalid hash format (must be MD5, SHA1, or SHA256)" };
      }
      break;
    case "url":
      try {
        new URL(value);
      } catch {
        return { valid: false, error: "Invalid URL format" };
      }
      break;
    case "email":
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return { valid: false, error: "Invalid email format" };
      }
      break;
  }
  return { valid: true };
}

// Export IOCs to CSV
export function exportIOCsToCSV(iocs: IOC[]): string {
  const headers = ["Type", "Value", "Threat Score", "First Seen", "Last Seen", "Source", "Notes"];
  const rows = iocs.map(ioc => [
    ioc.type,
    ioc.value,
    ioc.threat_score,
    new Date(ioc.first_seen).toLocaleString(),
    new Date(ioc.last_seen).toLocaleString(),
    ioc.source || "",
    ioc.notes || "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
  ].join("\n");

  return csvContent;
}

// Get threat intel lookup URLs
export function getThreatIntelURLs(ioc: IOC): { name: string; url: string }[] {
  const urls: { name: string; url: string }[] = [];

  switch (ioc.type) {
    case "ip":
      urls.push(
        { name: "AbuseIPDB", url: `https://www.abuseipdb.com/check/${ioc.value}` },
        { name: "VirusTotal", url: `https://www.virustotal.com/gui/ip-address/${ioc.value}` },
        { name: "Shodan", url: `https://www.shodan.io/host/${ioc.value}` }
      );
      break;
    case "domain":
      urls.push(
        { name: "VirusTotal", url: `https://www.virustotal.com/gui/domain/${ioc.value}` },
        { name: "URLScan", url: `https://urlscan.io/search/#${ioc.value}` }
      );
      break;
    case "hash":
      urls.push(
        { name: "VirusTotal", url: `https://www.virustotal.com/gui/file/${ioc.value}` },
        { name: "Hybrid Analysis", url: `https://www.hybrid-analysis.com/search?query=${ioc.value}` }
      );
      break;
    case "url":
      urls.push(
        { name: "VirusTotal", url: `https://www.virustotal.com/gui/url/${btoa(ioc.value)}` },
        { name: "URLScan", url: `https://urlscan.io/search/#${encodeURIComponent(ioc.value)}` }
      );
      break;
    case "email":
      urls.push(
        { name: "Have I Been Pwned", url: `https://haveibeenpwned.com/unifiedsearch/${ioc.value}` }
      );
      break;
  }

  return urls;
}
