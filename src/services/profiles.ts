import { supabase } from "@/lib/supabaseClient";

export interface Profile {
  id: string;
  display_name: string;
  full_name: string;
  role: string;
  bio: string;
  timezone: string;
  avatar_url: string | null;
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

export async function upsertMyProfile(profile: {
  display_name?: string;
  full_name?: string;
  role?: string;
  bio?: string;
  timezone?: string;
  avatar_url?: string | null;
}): Promise<Profile> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) throw userErr ?? new Error("Not signed in");

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userData.user.id,
        ...profile,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function uploadAvatar(file: File): Promise<string> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) throw userErr ?? new Error("Not signed in");

  const fileExt = file.name.split('.').pop();
  const fileName = `${userData.user.id}/avatar.${fileExt}`;

  // Delete old avatar if exists
  await supabase.storage.from('avatars').remove([fileName]);

  // Upload new avatar
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, { upsert: true });

  if (uploadError) throw uploadError;

  // Get public URL
  const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
  return data.publicUrl;
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
