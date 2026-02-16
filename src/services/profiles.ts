import { supabase } from "@/lib/supabaseClient";

export interface Profile {
  id: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export async function getMyProfile(): Promise<Profile | null> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .single();
  if (error) return null;
  return data as Profile;
}

export async function upsertMyProfile(displayName: string): Promise<Profile> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) throw userErr ?? new Error("Not signed in");

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userData.user.id,
        display_name: displayName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function getProfilesByIds(
  userIds: string[]
): Promise<Record<string, Profile>> {
  if (userIds.length === 0) return {};

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("id", userIds);
  if (error) return {};

  const map: Record<string, Profile> = {};
  for (const p of data as Profile[]) {
    map[p.id] = p;
  }
  return map;
}
