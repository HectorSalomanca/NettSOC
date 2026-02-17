import { supabase } from "@/lib/supabaseClient";
import { getActiveOrg } from "@/services/org";
import { logAudit } from "@/services/audit";
import { createNotification } from "@/services/notifications_v2";
import { logActivity } from "@/services/activity";
import { listMembers } from "@/services/members";
import { getProfilesByIds } from "@/services/profiles";

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
  incidentTitle?: string;
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

  // Log activity
  await logActivity({
    action: "commented",
    entityType: "incident",
    entityId: params.incidentId,
    entityTitle: params.incidentTitle,
    details: { comment_preview: params.content.substring(0, 100) },
  });

  // Parse @mentions and create notifications
  const mentions = parseMentions(params.content);
  if (mentions.length > 0) {
    try {
      const members = await listMembers();
      const userIds = members.map(m => m.user_id);
      const profiles = await getProfilesByIds(userIds);
      
      for (const mention of mentions) {
        // Find user by display_name
        const mentionedUser = Object.values(profiles).find(
          p => p.display_name.toLowerCase() === mention.toLowerCase()
        );
        
        if (mentionedUser && mentionedUser.id !== userData.user.id) {
          await createNotification({
            userId: mentionedUser.id,
            type: "mention",
            title: "You were mentioned in a comment",
            message: `${profiles[userData.user.id]?.display_name || "Someone"} mentioned you in ${params.incidentTitle || "an incident"}`,
            entityType: "incident",
            entityId: params.incidentId,
          });
        }
      }
    } catch (err) {
      console.error("Failed to process mentions:", err);
    }
  }

  return data as Comment;
}

function parseMentions(content: string): string[] {
  const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
  const matches = content.matchAll(mentionRegex);
  return Array.from(matches, m => m[1]);
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
