import { supabase } from "@/lib/supabaseClient";
import { getActiveOrg } from "@/services/org";

export interface NotificationPreferences {
  user_id: string;
  email_on_incident_create: boolean;
  email_on_incident_assign: boolean;
  email_on_comment_mention: boolean;
  email_on_status_change: boolean;
}

/**
 * Notification service - Foundation for email notifications
 * 
 * To implement actual email sending, you would need to:
 * 1. Create a Supabase Edge Function that sends emails via Resend, SendGrid, etc.
 * 2. Create a notifications_queue table to store pending notifications
 * 3. Set up database triggers or use this service to queue notifications
 * 4. Have the Edge Function poll the queue and send emails
 * 
 * For now, this service provides the structure for future implementation.
 */

export async function queueNotification(params: {
  recipientUserId: string;
  type: "incident_create" | "incident_assign" | "comment_mention" | "status_change";
  entityType: string;
  entityId: string;
  message: string;
}): Promise<void> {
  const orgId = getActiveOrg();
  if (!orgId) return;

  // In a full implementation, this would insert into a notifications_queue table
  // For now, we just log the notification intent
  console.log("Notification queued:", {
    org_id: orgId,
    recipient_user_id: params.recipientUserId,
    type: params.type,
    entity_type: params.entityType,
    entity_id: params.entityId,
    message: params.message,
    created_at: new Date().toISOString(),
  });

  // TODO: Insert into notifications_queue table when implemented
  // await supabase.from("notifications_queue").insert({
  //   org_id: orgId,
  //   recipient_user_id: params.recipientUserId,
  //   type: params.type,
  //   entity_type: params.entityType,
  //   entity_id: params.entityId,
  //   message: params.message,
  //   status: "pending",
  // });
}

export async function notifyIncidentAssignment(
  incidentId: string,
  incidentTitle: string,
  assignedUserId: string,
  severity?: string,
  dueAt?: string | null
): Promise<void> {
  let message = `You have been assigned to incident: ${incidentTitle}`;
  if (severity) {
    message += ` (Severity: ${severity})`;
  }
  if (dueAt) {
    message += ` - Due: ${new Date(dueAt).toLocaleString()}`;
  }
  
  await queueNotification({
    recipientUserId: assignedUserId,
    type: "incident_assign",
    entityType: "incident",
    entityId: incidentId,
    message,
  });
}

export async function notifyIncidentCreated(
  incidentId: string,
  incidentTitle: string,
  severity: string
): Promise<void> {
  // In a full implementation, this would notify all admins/analysts in the org
  // For now, just log the intent
  console.log("Would notify org members of new incident:", {
    incidentId,
    incidentTitle,
    severity,
  });
}

export async function notifyStatusChange(
  incidentId: string,
  incidentTitle: string,
  oldStatus: string,
  newStatus: string,
  assignedUserId?: string
): Promise<void> {
  if (assignedUserId) {
    await queueNotification({
      recipientUserId: assignedUserId,
      type: "status_change",
      entityType: "incident",
      entityId: incidentId,
      message: `Incident "${incidentTitle}" status changed from ${oldStatus} to ${newStatus}`,
    });
  }
}
