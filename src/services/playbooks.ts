import { supabase } from "@/lib/supabaseClient";
import { getActiveOrg } from "@/services/org";
import { logActivity } from "@/services/activity";
import { createNotification } from "@/services/notifications_v2";

export interface Playbook {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  incident_type: string | null;
  severity_trigger: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface PlaybookTask {
  id: string;
  playbook_id: string;
  order_num: number;
  title: string;
  description: string | null;
  required: boolean;
  estimated_minutes: number | null;
  automation_action: string | null;
  created_at: string;
}

export interface IncidentPlaybook {
  id: string;
  incident_id: string;
  playbook_id: string;
  started_at: string;
  completed_at: string | null;
  progress_pct: number;
  assigned_by: string | null;
}

export interface PlaybookTaskCompletion {
  id: string;
  incident_playbook_id: string;
  task_id: string;
  completed_by: string;
  completed_at: string;
  notes: string | null;
}

export interface PlaybookWithTasks extends Playbook {
  tasks: PlaybookTask[];
}

export interface IncidentPlaybookWithDetails extends IncidentPlaybook {
  playbook: Playbook;
  tasks: PlaybookTask[];
  completions: PlaybookTaskCompletion[];
}

// List all playbooks for the active org
export async function listPlaybooks(): Promise<Playbook[]> {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("No active organization");

  const { data, error } = await supabase
    .from("playbooks")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data as Playbook[];
}

// Get a single playbook with its tasks
export async function getPlaybookWithTasks(playbookId: string): Promise<PlaybookWithTasks> {
  const { data: playbook, error: playbookError } = await supabase
    .from("playbooks")
    .select("*")
    .eq("id", playbookId)
    .single();

  if (playbookError) throw playbookError;

  const { data: tasks, error: tasksError } = await supabase
    .from("playbook_tasks")
    .select("*")
    .eq("playbook_id", playbookId)
    .order("order_num");

  if (tasksError) throw tasksError;

  return {
    ...playbook,
    tasks: tasks || [],
  } as PlaybookWithTasks;
}

// Create a new playbook
export async function createPlaybook(params: {
  name: string;
  description?: string;
  incident_type?: string;
  severity_trigger?: string;
}): Promise<Playbook> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) throw new Error("Not authenticated");

  const orgId = getActiveOrg();
  if (!orgId) throw new Error("No active organization");

  const { data, error } = await supabase
    .from("playbooks")
    .insert({
      org_id: orgId,
      name: params.name,
      description: params.description || null,
      incident_type: params.incident_type || null,
      severity_trigger: params.severity_trigger || null,
      created_by: userData.user.id,
    })
    .select()
    .single();

  if (error) throw error;

  await logActivity({
    action: "created",
    entityType: "playbook",
    entityId: data.id,
    entityTitle: params.name,
  });

  return data as Playbook;
}

// Add tasks to a playbook
export async function addPlaybookTasks(
  playbookId: string,
  tasks: Array<{
    title: string;
    description?: string;
    required?: boolean;
    estimated_minutes?: number;
  }>
): Promise<PlaybookTask[]> {
  const tasksToInsert = tasks.map((task, index) => ({
    playbook_id: playbookId,
    order_num: index + 1,
    title: task.title,
    description: task.description || null,
    required: task.required || false,
    estimated_minutes: task.estimated_minutes || null,
  }));

  const { data, error } = await supabase
    .from("playbook_tasks")
    .insert(tasksToInsert)
    .select();

  if (error) throw error;
  return data as PlaybookTask[];
}

// Assign a playbook to an incident
export async function assignPlaybookToIncident(params: {
  incidentId: string;
  playbookId: string;
  incidentTitle?: string;
}): Promise<IncidentPlaybook> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("incident_playbooks")
    .insert({
      incident_id: params.incidentId,
      playbook_id: params.playbookId,
      assigned_by: userData.user.id,
    })
    .select()
    .single();

  if (error) throw error;

  // Get playbook name for notification
  const { data: playbook } = await supabase
    .from("playbooks")
    .select("name")
    .eq("id", params.playbookId)
    .single();

  await logActivity({
    action: "assigned playbook",
    entityType: "incident",
    entityId: params.incidentId,
    entityTitle: params.incidentTitle,
    details: { playbook_name: playbook?.name },
  });

  // Notify incident assignee
  const { data: incident } = await supabase
    .from("incidents")
    .select("assigned_to")
    .eq("id", params.incidentId)
    .single();

  if (incident?.assigned_to) {
    await createNotification({
      userId: incident.assigned_to,
      type: "status_change",
      title: "Playbook assigned to incident",
      message: `${playbook?.name || "A playbook"} was assigned to ${params.incidentTitle || "an incident"}`,
      entityType: "incident",
      entityId: params.incidentId,
    });
  }

  return data as IncidentPlaybook;
}

// Get playbooks for an incident
export async function getIncidentPlaybooks(incidentId: string): Promise<IncidentPlaybookWithDetails[]> {
  const { data: incidentPlaybooks, error: ipError } = await supabase
    .from("incident_playbooks")
    .select("*")
    .eq("incident_id", incidentId);

  if (ipError) throw ipError;
  if (!incidentPlaybooks || incidentPlaybooks.length === 0) return [];

  const results: IncidentPlaybookWithDetails[] = [];

  for (const ip of incidentPlaybooks) {
    const { data: playbook } = await supabase
      .from("playbooks")
      .select("*")
      .eq("id", ip.playbook_id)
      .single();

    const { data: tasks } = await supabase
      .from("playbook_tasks")
      .select("*")
      .eq("playbook_id", ip.playbook_id)
      .order("order_num");

    const { data: completions } = await supabase
      .from("playbook_task_completions")
      .select("*")
      .eq("incident_playbook_id", ip.id);

    results.push({
      ...ip,
      playbook: playbook as Playbook,
      tasks: tasks || [],
      completions: completions || [],
    } as IncidentPlaybookWithDetails);
  }

  return results;
}

// Complete a playbook task
export async function completePlaybookTask(params: {
  incidentPlaybookId: string;
  taskId: string;
  notes?: string;
  incidentId?: string;
  incidentTitle?: string;
}): Promise<PlaybookTaskCompletion> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("playbook_task_completions")
    .insert({
      incident_playbook_id: params.incidentPlaybookId,
      task_id: params.taskId,
      completed_by: userData.user.id,
      notes: params.notes || null,
    })
    .select()
    .single();

  if (error) throw error;

  // Update progress percentage
  await updatePlaybookProgress(params.incidentPlaybookId);

  // Log activity
  if (params.incidentId) {
    const { data: task } = await supabase
      .from("playbook_tasks")
      .select("title")
      .eq("id", params.taskId)
      .single();

    await logActivity({
      action: "completed task",
      entityType: "incident",
      entityId: params.incidentId,
      entityTitle: params.incidentTitle,
      details: { task_title: task?.title },
    });
  }

  return data as PlaybookTaskCompletion;
}

// Update playbook progress percentage
async function updatePlaybookProgress(incidentPlaybookId: string): Promise<void> {
  // Get total tasks
  const { data: incidentPlaybook } = await supabase
    .from("incident_playbooks")
    .select("playbook_id")
    .eq("id", incidentPlaybookId)
    .single();

  if (!incidentPlaybook) return;

  const { data: tasks } = await supabase
    .from("playbook_tasks")
    .select("id")
    .eq("playbook_id", incidentPlaybook.playbook_id);

  const { data: completions } = await supabase
    .from("playbook_task_completions")
    .select("id")
    .eq("incident_playbook_id", incidentPlaybookId);

  const totalTasks = tasks?.length || 0;
  const completedTasks = completions?.length || 0;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  await supabase
    .from("incident_playbooks")
    .update({
      progress_pct: progress,
      completed_at: progress === 100 ? new Date().toISOString() : null,
    })
    .eq("id", incidentPlaybookId);
}

// Uncomplete a task (for mistakes)
export async function uncompletePlaybookTask(
  incidentPlaybookId: string,
  taskId: string
): Promise<void> {
  const { error } = await supabase
    .from("playbook_task_completions")
    .delete()
    .eq("incident_playbook_id", incidentPlaybookId)
    .eq("task_id", taskId);

  if (error) throw error;

  await updatePlaybookProgress(incidentPlaybookId);
}
