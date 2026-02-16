import { supabase } from "@/lib/supabaseClient";
import { getActiveOrg } from "@/services/org";

export interface MemberRecord {
  id: string;
  org_id: string;
  user_id: string;
  role: string;
  created_at: string;
  email?: string;
}

export async function listMembers(orgId?: string): Promise<MemberRecord[]> {
  const targetOrg = orgId || getActiveOrg();
  if (!targetOrg) throw new Error("No active organization");

  const { data, error } = await supabase
    .from("org_members")
    .select("*")
    .eq("org_id", targetOrg)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as MemberRecord[];
}

export async function updateMemberRole(
  memberId: string,
  newRole: "admin" | "analyst" | "viewer"
): Promise<void> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) throw userErr ?? new Error("Not signed in");

  const orgId = getActiveOrg();
  if (!orgId) throw new Error("No active organization");

  const { data, error } = await supabase.rpc("update_member_role", {
    p_member_id: memberId,
    p_new_role: newRole,
    p_org_id: orgId,
  });
  if (error) throw error;
  if (data === false) throw new Error("Permission denied or invalid operation");
}

export async function removeMember(memberId: string): Promise<void> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) throw userErr ?? new Error("Not signed in");

  const orgId = getActiveOrg();
  if (!orgId) throw new Error("No active organization");

  const { data, error } = await supabase.rpc("remove_org_member", {
    p_member_id: memberId,
    p_org_id: orgId,
  });
  if (error) throw error;
  if (data === false)
    throw new Error(
      "Permission denied, member not found, or cannot remove last admin"
    );
}

export async function getMyRoleInActiveOrg(): Promise<string | null> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return null;

  const orgId = getActiveOrg();
  if (!orgId) return null;

  const { data, error } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userData.user.id)
    .single();
  if (error) return null;
  return data.role;
}
