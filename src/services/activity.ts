import { supabase } from "@/lib/supabaseClient";
import { getActiveOrg } from "@/services/org";

export interface ActivityEntry {
  id: string;
  org_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_title: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export async function logActivity(params: {
  action: string;
  entityType: string;
  entityId?: string;
  entityTitle?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const orgId = getActiveOrg();
  if (!orgId) return;

  const { data: userData } = await supabase.auth.getUser();
  
  await supabase.from("activity_feed").insert({
    org_id: orgId,
    user_id: userData?.user?.id || null,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId || null,
    entity_title: params.entityTitle || null,
    details: params.details || null,
  });
}

export interface ActivityFilters {
  entityType?: string;
  entityId?: string;
  userId?: string;
  limit?: number;
}

export async function getActivityFeed(filters: ActivityFilters = {}): Promise<ActivityEntry[]> {
  const orgId = getActiveOrg();
  if (!orgId) return [];

  let query = supabase
    .from("activity_feed")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (filters.entityType) {
    query = query.eq("entity_type", filters.entityType);
  }

  if (filters.entityId) {
    query = query.eq("entity_id", filters.entityId);
  }

  if (filters.userId) {
    query = query.eq("user_id", filters.userId);
  }

  if (filters.limit) {
    query = query.limit(filters.limit);
  } else {
    query = query.limit(100);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as ActivityEntry[];
}
