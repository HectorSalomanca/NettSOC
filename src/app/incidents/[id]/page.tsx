"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/services/auth";
import {
  getIncidentById,
  updateIncident,
  deleteIncident,
  Incident,
} from "@/services/incidents";
import {
  listTimeline,
  addTimelineEntry,
  TimelineEntry,
} from "@/services/timeline";
import {
  uploadEvidence,
  listEvidence,
  getSignedEvidenceUrl,
  EvidenceRecord,
} from "@/services/evidence";
import { getProfilesByIds, Profile } from "@/services/profiles";
import { getMyRoleInActiveOrg, listMembers, MemberRecord } from "@/services/members";

const SEVERITIES = ["low", "medium", "high", "critical"];
const STATUSES = ["open", "investigating", "contained", "eradicated", "closed"];

const EVENT_TYPES = [
  "note",
  "status_change",
  "triage",
  "containment",
  "eradication",
  "recovery",
];

const eventTypeColors: Record<string, string> = {
  note: "bg-zinc-700 text-zinc-300",
  status_change: "bg-indigo-900/50 text-indigo-300",
  triage: "bg-yellow-900/50 text-yellow-300",
  containment: "bg-blue-900/50 text-blue-300",
  eradication: "bg-emerald-900/50 text-emerald-300",
  recovery: "bg-purple-900/50 text-purple-300",
};

const severityColors: Record<string, string> = {
  low: "bg-blue-900/50 text-blue-300 border-blue-700",
  medium: "bg-yellow-900/50 text-yellow-300 border-yellow-700",
  high: "bg-orange-900/50 text-orange-300 border-orange-700",
  critical: "bg-red-900/50 text-red-300 border-red-700",
};

const statusColors: Record<string, string> = {
  open: "bg-red-900/40 text-red-300",
  investigating: "bg-yellow-900/40 text-yellow-300",
  contained: "bg-blue-900/40 text-blue-300",
  eradicated: "bg-emerald-900/40 text-emerald-300",
  closed: "bg-zinc-800 text-zinc-400",
};

export default function IncidentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Editable fields
  const [summary, setSummary] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");

  // Timeline state
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newEventType, setNewEventType] = useState("note");
  const [addingEntry, setAddingEntry] = useState(false);

  // Evidence state
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(true);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [profileMap, setProfileMap] = useState<Record<string, Profile>>({});
  const [myRole, setMyRole] = useState<string | null>(null);
  const [orgMembers, setOrgMembers] = useState<MemberRecord[]>([]);

  const fetchEvidence = useCallback(async () => {
    setEvidenceLoading(true);
    setEvidenceError(null);
    try {
      const rows = await listEvidence(id);
      setEvidence(rows);
    } catch (err: unknown) {
      setEvidenceError(
        err instanceof Error ? err.message : "Failed to load evidence"
      );
    } finally {
      setEvidenceLoading(false);
    }
  }, [id]);

  const fetchTimeline = useCallback(async () => {
    setTimelineLoading(true);
    setTimelineError(null);
    try {
      const entries = await listTimeline(id);
      setTimeline(entries);
    } catch (err: unknown) {
      setTimelineError(
        err instanceof Error ? err.message : "Failed to load timeline"
      );
    } finally {
      setTimelineLoading(false);
    }
  }, [id]);

  useEffect(() => {
    async function init() {
      try {
        const session = await getSession();
        if (!session) {
          router.push("/login");
          return;
        }
        const data = await getIncidentById(id);
        setIncident(data);
        setSummary(data.summary || "");
        setSeverity(data.severity);
        setStatus(data.status);
        setAssignedTo(data.assigned_to || "");
        const [entries] = await Promise.all([
          listTimeline(id),
          fetchEvidence(),
        ]);
        setTimeline(entries);
        setTimelineLoading(false);

        const userIds = new Set<string>();
        if (data.created_by) userIds.add(data.created_by);
        entries.forEach((e: TimelineEntry) => { if (e.created_by) userIds.add(e.created_by); });
        if (userIds.size > 0) {
          const profiles = await getProfilesByIds(Array.from(userIds));
          setProfileMap(profiles);
        }

        const role = await getMyRoleInActiveOrg();
        setMyRole(role);

        const members = await listMembers();
        setOrgMembers(members);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Failed to load incident"
        );
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [id, router, fetchTimeline, fetchEvidence]);

  async function handleUpdate() {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const updated = await updateIncident(id, { 
        summary, 
        severity, 
        status,
        assigned_to: assignedTo || null 
      });
      setIncident(updated);
      setSuccessMsg("Incident updated successfully.");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to update incident"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAddEntry() {
    if (!newMessage.trim()) return;
    setAddingEntry(true);
    setTimelineError(null);
    try {
      await addTimelineEntry(id, newMessage.trim(), newEventType);
      setNewMessage("");
      setNewEventType("note");
      await fetchTimeline();
    } catch (err: unknown) {
      setTimelineError(
        err instanceof Error ? err.message : "Failed to add timeline entry"
      );
    } finally {
      setAddingEntry(false);
    }
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setEvidenceError(null);
    try {
      await uploadEvidence(id, selectedFile);
      setSelectedFile(null);
      const fileInput = document.getElementById("evidenceFile") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      await fetchEvidence();
    } catch (err: unknown) {
      setEvidenceError(
        err instanceof Error ? err.message : "Failed to upload evidence"
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleOpenEvidence(record: EvidenceRecord) {
    setOpeningId(record.id);
    setEvidenceError(null);
    try {
      const url = await getSignedEvidenceUrl(record.file_path);
      window.open(url, "_blank");
    } catch (err: unknown) {
      setEvidenceError(
        err instanceof Error ? err.message : "Failed to get signed URL"
      );
    } finally {
      setOpeningId(null);
    }
  }

  async function handleCopyLink(record: EvidenceRecord) {
    setEvidenceError(null);
    try {
      const url = await getSignedEvidenceUrl(record.file_path);
      await navigator.clipboard.writeText(url);
    } catch (err: unknown) {
      setEvidenceError(
        err instanceof Error ? err.message : "Failed to copy link"
      );
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this incident?")) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteIncident(id);
      router.push("/incidents");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to delete incident"
      );
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="flex items-center gap-3 text-zinc-400">
          <svg
            className="h-5 w-5 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Loading…
        </div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/incidents"
            className="text-sm text-zinc-400 transition hover:text-white"
          >
            ← Back to Incidents
          </Link>
          <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-12 text-center">
            <p className="text-zinc-400">Incident not found.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/incidents"
            className="text-sm text-zinc-400 transition hover:text-white"
          >
            ← Back to Incidents
          </Link>
        </div>

        {/* Title + badges */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">{incident.title}</h1>
          <div className="mt-2 flex items-center gap-3">
            <span
              className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                severityColors[incident.severity] ||
                "bg-zinc-800 text-zinc-400 border-zinc-700"
              }`}
            >
              {incident.severity}
            </span>
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                statusColors[incident.status] || "bg-zinc-800 text-zinc-400"
              }`}
            >
              {incident.status}
            </span>
            <span className="text-xs text-zinc-500">
              Created {new Date(incident.created_at).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-900/50 border border-red-700 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-6 rounded-lg bg-green-900/50 border border-green-700 px-4 py-3 text-sm text-green-300">
            {successMsg}
          </div>
        )}

        {/* Edit form */}
        <div className="space-y-5 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          {/* Summary */}
          <div>
            <label
              htmlFor="summary"
              className="block text-sm font-medium text-zinc-300"
            >
              Summary
            </label>
            <textarea
              id="summary"
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
            />
          </div>

          {/* Severity + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="severity"
                className="block text-sm font-medium text-zinc-300"
              >
                Severity
              </label>
              <select
                id="severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="status"
                className="block text-sm font-medium text-zinc-300"
              >
                Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="assignedTo"
                className="block text-sm font-medium text-zinc-300"
              >
                Assigned To
              </label>
              <select
                id="assignedTo"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                disabled={myRole === "viewer"}
                className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              >
                <option value="">Unassigned</option>
                {orgMembers.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {profileMap[member.user_id]?.display_name || member.user_id.slice(0, 8) + "…"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            {myRole === "admin" && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg border border-red-800 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? "Deleting…" : "Delete Incident"}
              </button>
            )}
            {myRole && myRole !== "viewer" && (
              <button
                onClick={handleUpdate}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            )}
          </div>
        </div>

        {/* Timeline Section */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-white mb-4">Timeline</h2>

          {/* Add Entry Form */}
          {myRole && myRole !== "viewer" && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 mb-6">
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="eventType"
                  className="block text-sm font-medium text-zinc-300 mb-1"
                >
                  Event Type
                </label>
                <select
                  id="eventType"
                  value={newEventType}
                  onChange={(e) => setNewEventType(e.target.value)}
                  className="block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="timelineMessage"
                  className="block text-sm font-medium text-zinc-300 mb-1"
                >
                  Message
                </label>
                <textarea
                  id="timelineMessage"
                  rows={3}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Describe what happened or what action was taken…"
                  className="block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
                />
              </div>
              <button
                onClick={handleAddEntry}
                disabled={addingEntry || !newMessage.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingEntry ? "Adding…" : "Add Entry"}
              </button>
            </div>
          </div>
          )}

          {/* Timeline Error */}
          {timelineError && (
            <div className="mb-4 rounded-lg bg-red-900/50 border border-red-700 px-4 py-3 text-sm text-red-300">
              {timelineError}
            </div>
          )}

          {/* Timeline List */}
          {timelineLoading ? (
            <div className="flex items-center gap-3 text-zinc-400 py-6">
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="text-sm">Loading timeline…</span>
            </div>
          ) : timeline.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-700 py-10 text-center">
              <p className="text-zinc-500 text-sm">No timeline entries yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {timeline.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        eventTypeColors[entry.event_type] ||
                        "bg-zinc-700 text-zinc-300"
                      }`}
                    >
                      {entry.event_type.replace("_", " ")}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {profileMap[entry.created_by]?.display_name || entry.created_by?.slice(0, 8) + "…"}
                      {" · "}
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-200 whitespace-pre-wrap">
                    {entry.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Evidence Section */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-white mb-4">Evidence</h2>

          {/* Upload Form */}
          {myRole && myRole !== "viewer" && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 mb-6">
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="evidenceFile"
                  className="block text-sm font-medium text-zinc-300 mb-1"
                >
                  Select File
                </label>
                <input
                  id="evidenceFile"
                  type="file"
                  onChange={(e) =>
                    setSelectedFile(e.target.files?.[0] || null)
                  }
                  className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-zinc-200 hover:file:bg-zinc-600 file:cursor-pointer file:transition"
                />
              </div>
              <button
                onClick={handleUpload}
                disabled={uploading || !selectedFile}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? "Uploading…" : "Upload Evidence"}
              </button>
            </div>
          </div>
          )}

          {/* Evidence Error */}
          {evidenceError && (
            <div className="mb-4 rounded-lg bg-red-900/50 border border-red-700 px-4 py-3 text-sm text-red-300">
              {evidenceError}
            </div>
          )}

          {/* Evidence List */}
          {evidenceLoading ? (
            <div className="flex items-center gap-3 text-zinc-400 py-6">
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="text-sm">Loading evidence…</span>
            </div>
          ) : evidence.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-700 py-10 text-center">
              <p className="text-zinc-500 text-sm">No evidence uploaded yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {evidence.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">
                      {rec.file_name}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {rec.mime_type || "unknown type"}
                      {rec.size_bytes
                        ? ` · ${(rec.size_bytes / 1024).toFixed(1)} KB`
                        : ""}
                      {" · "}
                      {new Date(rec.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => handleOpenEvidence(rec)}
                      disabled={openingId === rec.id}
                      className="rounded-lg bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-600 disabled:opacity-50"
                    >
                      {openingId === rec.id ? "Opening…" : "Open"}
                    </button>
                    <button
                      onClick={() => handleCopyLink(rec)}
                      className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
                    >
                      Copy Link
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
