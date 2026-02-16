import { supabase } from "@/lib/supabaseClient";

const ACTIVE_ORG_KEY = "nettsoc_active_org_id";

export interface Organization {
  id: string;
  name: string;
  created_at: string;
  created_by: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export async function createOrganization(name: string): Promise<Organization> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) throw userErr ?? new Error("Not signed in");

  const userId = userData.user.id;

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .insert({ name, created_by: userId })
    .select()
    .single();

  if (orgErr) throw orgErr;

  const { error: memErr } = await supabase
    .from("org_members")
    .insert({ org_id: org.id, user_id: userId, role: "admin" });

  if (memErr) throw memErr;

  setActiveOrg(org.id);

  return org;
}

export async function getMyOrganizations(): Promise<Organization[]> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) throw userErr ?? new Error("Not signed in");

  const userId = userData.user.id;

  const { data: memberData, error: memberError } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId);
  if (memberError) throw memberError;

  if (!memberData || memberData.length === 0) {
    return [];
  }

  const orgIds = memberData.map((m) => m.org_id);

  const { data: orgs, error: orgError } = await supabase
    .from("organizations")
    .select("*")
    .in("id", orgIds);
  if (orgError) throw orgError;

  return orgs as Organization[];
}

export function getActiveOrg(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_ORG_KEY);
}

export function setActiveOrg(orgId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_ORG_KEY, orgId);
}

export function clearActiveOrg(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACTIVE_ORG_KEY);
}

export async function getOrgMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from("org_members")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as OrgMember[];
}

export async function getActiveOrgDetails(): Promise<Organization | null> {
  const activeOrgId = getActiveOrg();
  if (!activeOrgId) return null;

  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", activeOrgId)
    .single();
  if (error) return null;
  return data as Organization;
}
