import { supabase } from "@/lib/supabaseClient";
import { getActiveOrg } from "@/services/org";

export interface Notification {
  id: string;
  org_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  read: boolean;
  created_at: string;
}

export async function createNotification(params: {
  userId: string;
  type: "incident_assign" | "mention" | "incident_critical" | "incident_due_soon" | "incident_overdue" | "status_change";
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}): Promise<void> {
  const orgId = getActiveOrg();
  if (!orgId) return;

  await supabase.from("notifications").insert({
    org_id: orgId,
    user_id: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    entity_type: params.entityType || null,
    entity_id: params.entityId || null,
  });
}

export async function getMyNotifications(limit = 50): Promise<Notification[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as Notification[];
}

export async function getUnreadCount(): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return 0;

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userData.user.id)
    .eq("read", false);

  if (error) return 0;
  return count || 0;
}

export async function markAsRead(notificationId: string): Promise<void> {
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId);
}

export async function markAllAsRead(): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return;

  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userData.user.id)
    .eq("read", false);
}
