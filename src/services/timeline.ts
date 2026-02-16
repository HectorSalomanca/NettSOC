import { supabase } from "@/lib/supabaseClient";
import { getActiveOrg } from "@/services/org";

export interface TimelineEntry {
  id: string;
  incident_id: string;
  event_type: string;
  message: string;
  created_at: string;
  created_by: string;
  org_id: string;
}

export async function listTimeline(
  incidentId: string
): Promise<TimelineEntry[]> {
  const { data, error } = await supabase
    .from("incident_timeline")
    .select("*")
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as TimelineEntry[];
}

export async function addTimelineEntry(
  incidentId: string,
  message: string,
  eventType: string = "note"
): Promise<TimelineEntry> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const orgId = getActiveOrg();
  if (!orgId) throw new Error("No active organization");

  const { data, error } = await supabase
    .from("incident_timeline")
    .insert({
      incident_id: incidentId,
      event_type: eventType,
      message,
      created_by: session.user.id,
      org_id: orgId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as TimelineEntry;
}
