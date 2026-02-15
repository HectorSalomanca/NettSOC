import { supabase } from "@/lib/supabaseClient";

export async function listNotes() {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createNote(content: string, userId: string) {
  const { data, error } = await supabase
    .from("notes")
    .insert({ content, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNote(noteId: string) {
  const { error } = await supabase.from("notes").delete().eq("id", noteId);
  if (error) throw error;
}
