import { supabase } from "@/lib/supabaseClient";
import { getActiveOrg } from "@/services/org";
import { logActivity } from "@/services/activity";

export interface IncidentTemplate {
  id: string;
  org_id: string;
  name: string;
  title_template: string;
  summary_template: string | null;
  default_severity: string;
  default_status: string;
  default_playbook_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface IncidentTag {
  id: string;
  org_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface IncidentTagAssignment {
  incident_id: string;
  tag_id: string;
  assigned_at: string;
  assigned_by: string | null;
}

// Templates

export async function listTemplates(): Promise<IncidentTemplate[]> {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("No active organization");

  const { data, error } = await supabase
    .from("incident_templates")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data as IncidentTemplate[];
}

export async function getTemplate(templateId: string): Promise<IncidentTemplate> {
  const { data, error } = await supabase
    .from("incident_templates")
    .select("*")
    .eq("id", templateId)
    .single();

  if (error) throw error;
  return data as IncidentTemplate;
}

export async function createTemplate(params: {
  name: string;
  title_template: string;
  summary_template?: string;
  default_severity?: string;
  default_status?: string;
  default_playbook_id?: string;
}): Promise<IncidentTemplate> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) throw new Error("Not authenticated");

  const orgId = getActiveOrg();
  if (!orgId) throw new Error("No active organization");

  const { data, error } = await supabase
    .from("incident_templates")
    .insert({
      org_id: orgId,
      name: params.name,
      title_template: params.title_template,
      summary_template: params.summary_template || null,
      default_severity: params.default_severity || "medium",
      default_status: params.default_status || "open",
      default_playbook_id: params.default_playbook_id || null,
      created_by: userData.user.id,
    })
    .select()
    .single();

  if (error) throw error;

  await logActivity({
    action: "created",
    entityType: "template",
    entityId: data.id,
    entityTitle: params.name,
  });

  return data as IncidentTemplate;
}

export async function updateTemplate(
  templateId: string,
  params: Partial<Pick<IncidentTemplate, "name" | "title_template" | "summary_template" | "default_severity" | "default_status" | "default_playbook_id">>
): Promise<IncidentTemplate> {
  const { data, error } = await supabase
    .from("incident_templates")
    .update({ ...params, updated_at: new Date().toISOString() })
    .eq("id", templateId)
    .select()
    .single();

  if (error) throw error;
  return data as IncidentTemplate;
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const { error } = await supabase
    .from("incident_templates")
    .update({ is_active: false })
    .eq("id", templateId);

  if (error) throw error;
}

// Tags

export async function listTags(): Promise<IncidentTag[]> {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("No active organization");

  const { data, error } = await supabase
    .from("incident_tags")
    .select("*")
    .eq("org_id", orgId)
    .order("name");

  if (error) throw error;
  return data as IncidentTag[];
}

export async function createTag(params: {
  name: string;
  color?: string;
}): Promise<IncidentTag> {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("No active organization");

  const { data, error } = await supabase
    .from("incident_tags")
    .insert({
      org_id: orgId,
      name: params.name,
      color: params.color || "#6b7280",
    })
    .select()
    .single();

  if (error) throw error;
  return data as IncidentTag;
}

export async function getOrCreateTag(name: string, color?: string): Promise<IncidentTag> {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("No active organization");

  // Try to find existing tag
  const { data: existing } = await supabase
    .from("incident_tags")
    .select("*")
    .eq("org_id", orgId)
    .eq("name", name)
    .single();

  if (existing) return existing as IncidentTag;

  // Create new tag
  return createTag({ name, color });
}

// Tag Assignments

export async function getIncidentTags(incidentId: string): Promise<IncidentTag[]> {
  const { data, error } = await supabase
    .from("incident_tag_assignments")
    .select("tag_id, incident_tags(*)")
    .eq("incident_id", incidentId);

  if (error) throw error;
  return (data || []).map((item: any) => item.incident_tags).filter(Boolean) as IncidentTag[];
}

export async function addTagToIncident(params: {
  incidentId: string;
  tagId: string;
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("incident_tag_assignments")
    .insert({
      incident_id: params.incidentId,
      tag_id: params.tagId,
      assigned_by: userData.user.id,
    });

  if (error && !error.message.includes("duplicate")) throw error;
}

export async function removeTagFromIncident(params: {
  incidentId: string;
  tagId: string;
}): Promise<void> {
  const { error } = await supabase
    .from("incident_tag_assignments")
    .delete()
    .eq("incident_id", params.incidentId)
    .eq("tag_id", params.tagId);

  if (error) throw error;
}

export async function bulkAddTagToIncidents(params: {
  incidentIds: string[];
  tagId: string;
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) throw new Error("Not authenticated");

  const assignments = params.incidentIds.map(incidentId => ({
    incident_id: incidentId,
    tag_id: params.tagId,
    assigned_by: userData.user.id,
  }));

  const { error } = await supabase
    .from("incident_tag_assignments")
    .upsert(assignments, { onConflict: "incident_id,tag_id" });

  if (error) throw error;
}

export async function bulkRemoveTagFromIncidents(params: {
  incidentIds: string[];
  tagId: string;
}): Promise<void> {
  const { error } = await supabase
    .from("incident_tag_assignments")
    .delete()
    .in("incident_id", params.incidentIds)
    .eq("tag_id", params.tagId);

  if (error) throw error;
}
