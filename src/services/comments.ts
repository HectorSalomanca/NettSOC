import { supabase } from "@/lib/supabaseClient";
import { getActiveOrg } from "@/services/org";
import { logAudit } from "@/services/audit";

export interface Comment {
  id: string;
  incident_id: string;
  org_id: string;
  user_id: string;
  content: string;
  parent_id?: string | null;
  created_at: string;
  updated_at: string;
}

export async function listComments(incidentId: string): Promise<Comment[]> {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("No active organization");

  const { data, error } = await supabase
    .from("incident_comments")
    .select("*")
    .eq("incident_id", incidentId)
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as Comment[];
}

export async function createComment(params: {
  incidentId: string;
  content: string;
  parentId?: string;
}): Promise<Comment> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) throw userErr ?? new Error("Not signed in");

  const orgId = getActiveOrg();
  if (!orgId) throw new Error("No active organization");

  const { data, error } = await supabase
    .from("incident_comments")
    .insert({
      incident_id: params.incidentId,
      org_id: orgId,
      user_id: userData.user.id,
      content: params.content,
      parent_id: params.parentId || null,
    })
    .select()
    .single();
  if (error) throw error;

  await logAudit({
    action: "create",
    entity_type: "comment",
    entity_id: data.id,
    details: { incident_id: params.incidentId },
  });

  return data as Comment;
}

export async function updateComment(
  commentId: string,
  content: string
): Promise<Comment> {
  const { data, error } = await supabase
    .from("incident_comments")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", commentId)
    .select()
    .single();
  if (error) throw error;

  await logAudit({
    action: "update",
    entity_type: "comment",
    entity_id: commentId,
  });

  return data as Comment;
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase
    .from("incident_comments")
    .delete()
    .eq("id", commentId);
  if (error) throw error;

  await logAudit({
    action: "delete",
    entity_type: "comment",
    entity_id: commentId,
  });
}
