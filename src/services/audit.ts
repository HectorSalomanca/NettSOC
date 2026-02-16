import { supabase } from "@/lib/supabaseClient";
import { getActiveOrg } from "@/services/org";

export interface AuditLogEntry {
  id: string;
  org_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: Record<string, unknown> | null;
  created_at: string;
}

export async function logAudit(params: {
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return;

  const orgId = getActiveOrg();
  if (!orgId) return;

  await supabase.from("audit_log").insert({
    org_id: orgId,
    user_id: userData.user.id,
    action: params.action,
    entity_type: params.entity_type,
    entity_id: params.entity_id || null,
    details: params.details || null,
  });
}

export async function listAuditLogs(params?: {
  entity_type?: string;
  entity_id?: string;
  user_id?: string;
  limit?: number;
}): Promise<AuditLogEntry[]> {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("No active organization");

  let query = supabase
    .from("audit_log")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (params?.entity_type) {
    query = query.eq("entity_type", params.entity_type);
  }
  if (params?.entity_id) {
    query = query.eq("entity_id", params.entity_id);
  }
  if (params?.user_id) {
    query = query.eq("user_id", params.user_id);
  }
  if (params?.limit) {
    query = query.limit(params.limit);
  } else {
    query = query.limit(100);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as AuditLogEntry[];
}
