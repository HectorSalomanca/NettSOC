import { supabase } from "@/lib/supabaseClient";
import { getActiveOrg, setActiveOrg } from "@/services/org";

export interface InviteRecord {
  id: string;
  org_id: string;
  code: string;
  role: string;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  max_uses: number;
  uses: number;
  is_active: boolean;
}

export async function createInvite(params: {
  role?: "admin" | "analyst" | "viewer";
  expiresInDays?: number;
  maxUses?: number;
}): Promise<InviteRecord> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) throw userErr ?? new Error("Not signed in");

  const orgId = getActiveOrg();
  if (!orgId) throw new Error("No active organization");

  const code = generateCode(10);
  const expiresAt = params.expiresInDays
    ? new Date(
        Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000
      ).toISOString()
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("org_invites")
    .insert({
      org_id: orgId,
      code,
      role: params.role || "analyst",
      created_by: userData.user.id,
      expires_at: expiresAt,
      max_uses: params.maxUses || 1,
    })
    .select()
    .single();
  if (error) throw error;
  return data as InviteRecord;
}

export async function listInvites(): Promise<InviteRecord[]> {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("No active organization");

  const { data, error } = await supabase
    .from("org_invites")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as InviteRecord[];
}

export async function deactivateInvite(inviteId: string): Promise<void> {
  const { error } = await supabase
    .from("org_invites")
    .update({ is_active: false })
    .eq("id", inviteId);
  if (error) throw error;
}

export async function joinOrgByCode(code: string): Promise<string> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) throw userErr ?? new Error("Not signed in");

  const { data, error } = await supabase.rpc("join_org_by_invite", {
    p_code: code,
  });
  if (error) throw error;
  if (!data) throw new Error("Failed to join organization");

  const orgId = data as string;
  setActiveOrg(orgId);
  return orgId;
}

function generateCode(length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}
