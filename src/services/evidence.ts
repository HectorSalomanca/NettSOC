import { supabase } from "@/lib/supabaseClient";
import { getActiveOrg } from "@/services/org";

export interface EvidenceRecord {
  id: string;
  incident_id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  uploaded_by: string;
  org_id: string;
}

export async function uploadEvidence(
  incidentId: string,
  file: File
): Promise<EvidenceRecord> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const userId = session.user.id;
  const timestamp = Date.now();
  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${userId}/${incidentId}/${timestamp}-${sanitized}`;

  const { error: uploadError } = await supabase.storage
    .from("incident-evidence")
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const orgId = getActiveOrg();
  if (!orgId) throw new Error("No active organization");

  const { data, error: insertError } = await supabase
    .from("incident_evidence")
    .insert({
      incident_id: incidentId,
      file_path: storagePath,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: userId,
      org_id: orgId,
    })
    .select()
    .single();
  if (insertError) throw insertError;

  return data as EvidenceRecord;
}

export async function listEvidence(
  incidentId: string
): Promise<EvidenceRecord[]> {
  const { data, error } = await supabase
    .from("incident_evidence")
    .select("*")
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as EvidenceRecord[];
}

export async function getSignedEvidenceUrl(
  filePath: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from("incident-evidence")
    .createSignedUrl(filePath, 300);
  if (error) throw error;
  return data.signedUrl;
}
