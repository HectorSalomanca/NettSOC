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
  getMttrStats,
  MttrStats,
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
import { listComments, createComment, deleteComment, Comment } from "@/services/comments";
import { notifyIncidentAssignment } from "@/services/notifications";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  note: "bg-zinc-100 text-zinc-600",
  status_change: "bg-indigo-50 text-indigo-600",
  triage: "bg-amber-50 text-amber-600",
  containment: "bg-blue-50 text-blue-600",
  eradication: "bg-emerald-50 text-emerald-600",
  recovery: "bg-purple-50 text-purple-600",
};

const severityColors: Record<string, string> = {
  low: "bg-blue-50 text-blue-600",
  medium: "bg-amber-50 text-amber-600",
  high: "bg-orange-50 text-orange-600",
  critical: "bg-red-50 text-red-600",
};

const statusColors: Record<string, string> = {
  open: "bg-red-50 text-red-600",
  investigating: "bg-amber-50 text-amber-600",
  contained: "bg-blue-50 text-blue-600",
  eradicated: "bg-emerald-50 text-emerald-600",
  closed: "bg-zinc-100 text-zinc-500",
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
  const [dueAt, setDueAt] = useState<string>("");

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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  // MTTR state
  const [mttr, setMttr] = useState<MttrStats | null>(null);

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

  const fetchComments = useCallback(async () => {
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const rows = await listComments(id);
      setComments(rows);
    } catch (err: unknown) {
      setCommentsError(
        err instanceof Error ? err.message : "Failed to load comments"
      );
    } finally {
      setCommentsLoading(false);
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
        setCurrentUserId(session.user.id);
        const data = await getIncidentById(id);
        setIncident(data);
        setSummary(data.summary || "");
        setSeverity(data.severity);
        setStatus(data.status);
        setAssignedTo(data.assigned_to || "");
        setDueAt(data.due_at ? new Date(data.due_at).toISOString().slice(0, 16) : "");
        const [entries] = await Promise.all([
          listTimeline(id),
          fetchEvidence(),
          fetchComments(),
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

        const commentsList = await listComments(id);
        setComments(commentsList);
        setCommentsLoading(false);

        // Fetch MTTR stats (non-blocking)
        getMttrStats().then(setMttr).catch(() => {});
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
      const oldIncident = incident;
      const updated = await updateIncident(id, { 
        summary, 
        severity, 
        status,
        assigned_to: assignedTo || null,
        due_at: dueAt ? new Date(dueAt).toISOString() : null
      });
      setIncident(updated);

      // Create system event comments for key changes
      const systemEvents: string[] = [];
      
      if (oldIncident && oldIncident.severity !== severity) {
        systemEvents.push(`**System:** Severity changed from **${oldIncident.severity}** → **${severity}**`);
      }
      if (oldIncident && oldIncident.status !== status) {
        systemEvents.push(`**System:** Status changed from **${oldIncident.status}** → **${status}**`);
      }
      if (oldIncident && oldIncident.assigned_to !== (assignedTo || null)) {
        const oldName = oldIncident.assigned_to 
          ? (profileMap[oldIncident.assigned_to]?.display_name || "Unknown")
          : "Unassigned";
        const newName = assignedTo 
          ? (profileMap[assignedTo]?.display_name || "Unknown")
          : "Unassigned";
        systemEvents.push(`**System:** Assigned from **${oldName}** → **${newName}**`);
        
        // Send email notification to newly assigned user
        if (assignedTo && assignedTo !== oldIncident.assigned_to) {
          await notifyIncidentAssignment(
            id,
            incident?.title || "Untitled Incident",
            assignedTo,
            severity,
            dueAt ? new Date(dueAt).toISOString() : null
          );
        }
      }

      // Post system events as comments
      for (const event of systemEvents) {
        await createComment({ incidentId: id, content: event });
      }

      if (systemEvents.length > 0) {
        await fetchComments();
      }

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
    const url = `${window.location.origin}/incidents/${id}/evidence/${record.id}`;
    await navigator.clipboard.writeText(url);
  }

  async function handleAddComment() {
    if (!newComment.trim()) return;
    setAddingComment(true);
    setCommentsError(null);
    try {
      await createComment({ 
        incidentId: id, 
        content: newComment.trim(),
        incidentTitle: incident?.title 
      });
      setNewComment("");
      await fetchComments();
    } catch (err: unknown) {
      setCommentsError(
        err instanceof Error ? err.message : "Failed to add comment"
      );
    } finally {
      setAddingComment(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    setDeletingCommentId(commentId);
    setCommentsError(null);
    try {
      await deleteComment(commentId);
      await fetchComments();
    } catch (err: unknown) {
      setCommentsError(
        err instanceof Error ? err.message : "Failed to delete comment"
      );
    } finally {
      setDeletingCommentId(null);
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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted">
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
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/incidents"
            className="text-sm text-muted transition hover:text-foreground"
          >
            ← Back to Incidents
          </Link>
          <div className="mt-8 rounded-2xl bg-white shadow-sm px-6 py-12 text-center">
            <p className="text-muted">Incident not found.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/incidents"
            className="text-sm text-muted transition hover:text-foreground"
          >
            ← Back to Incidents
          </Link>
        </div>

        {/* Title + badges */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{incident.title}</h1>
          <div className="mt-2 flex items-center gap-3">
            <span
              className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                severityColors[incident.severity] ||
                "bg-zinc-100 text-zinc-500"
              }`}
            >
              {incident.severity}
            </span>
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                statusColors[incident.status] || "bg-zinc-100 text-zinc-500"
              }`}
            >
              {incident.status}
            </span>
            <span className="text-xs text-muted">
              Created {new Date(incident.created_at).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-600">
            {successMsg}
          </div>
        )}

        {/* Resolution Metrics */}
        <div className="mb-6 rounded-2xl bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Resolution Metrics</h2>
          <div className="grid grid-cols-3 gap-4">
            {/* This incident */}
            <div>
              <p className="text-xs text-muted mb-0.5">This Incident</p>
              <p className="text-base font-bold text-foreground">
                {(() => {
                  if (incident.closed_at) {
                    const ms = new Date(incident.closed_at).getTime() - new Date(incident.created_at).getTime();
                    const hours = Math.floor(ms / (1000 * 60 * 60));
                    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
                    return `${hours}h ${mins}m`;
                  }
                  const ms = Date.now() - new Date(incident.created_at).getTime();
                  const hours = Math.floor(ms / (1000 * 60 * 60));
                  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
                  return `${hours}h ${mins}m`;
                })()}
              </p>
              <p className="text-xs text-muted">
                {incident.closed_at ? "Resolved in" : "Open for"}
              </p>
            </div>
            {/* Median MTTR */}
            <div>
              <p className="text-xs text-muted mb-0.5">Median MTTR</p>
              <p className="text-base font-bold text-foreground">
                {mttr?.medianHours != null ? `${mttr.medianHours}h` : "—"}
              </p>
              <p className="text-xs text-muted">Last 30 days</p>
            </div>
            {/* p90 MTTR */}
            <div>
              <p className="text-xs text-muted mb-0.5">p90 MTTR</p>
              <p className="text-base font-bold text-foreground">
                {mttr?.p90Hours != null ? `${mttr.p90Hours}h` : "—"}
              </p>
              <p className="text-xs text-muted">{mttr?.count ?? 0} incidents</p>
            </div>
          </div>
          {/* Tiny comparison bar: this incident vs median */}
          {mttr?.medianHours != null && (
            <div className="mt-3">
              <div className="flex items-center gap-2 text-xs text-muted mb-1">
                <span>This incident vs median</span>
              </div>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                {(() => {
                  const incMs = incident.closed_at
                    ? new Date(incident.closed_at).getTime() - new Date(incident.created_at).getTime()
                    : Date.now() - new Date(incident.created_at).getTime();
                  const incHours = incMs / (1000 * 60 * 60);
                  const medianH = mttr.medianHours!;
                  const maxH = Math.max(incHours, medianH) * 1.2;
                  const incPct = Math.min((incHours / maxH) * 100, 100);
                  const isOver = incHours > medianH;
                  return (
                    <div
                      className={`h-full rounded-full transition-all ${isOver ? "bg-red-400" : "bg-emerald-400"}`}
                      style={{ width: `${incPct}%` }}
                    />
                  );
                })()}
              </div>
              <div className="flex justify-between text-xs text-muted mt-1">
                <span>0h</span>
                <span>Median: {mttr.medianHours}h</span>
              </div>
            </div>
          )}
        </div>

        {/* Edit form */}
        <div className="space-y-5 rounded-2xl bg-white shadow-sm p-6">
          {/* Summary */}
          <div>
            <label
              htmlFor="summary"
              className="block text-sm font-medium text-foreground"
            >
              Summary (Markdown supported)
            </label>
            <textarea
              id="summary"
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Describe the incident... You can use **bold**, *italic*, and other markdown formatting."
              className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
            />
            {summary && (
              <div className="mt-2 rounded-xl border border-border bg-background px-3 py-2">
                <p className="text-xs text-muted mb-1">Preview:</p>
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {summary}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>

          {/* Severity + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="severity"
                className="block text-sm font-medium text-foreground"
              >
                Severity
              </label>
              <select
                id="severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
                className="block text-sm font-medium text-foreground"
              >
                Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
                className="block text-sm font-medium text-foreground"
              >
                Assigned To
              </label>
              <select
                id="assignedTo"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                disabled={myRole === "viewer"}
                className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
              >
                <option value="">Unassigned</option>
                {orgMembers.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {profileMap[member.user_id]?.display_name || member.user_id.slice(0, 8) + "…"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="dueAt"
                className="block text-sm font-medium text-foreground"
              >
                SLA Due Date
              </label>
              <input
                type="datetime-local"
                id="dueAt"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                disabled={myRole === "viewer"}
                className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
              />
              {incident?.due_at && (
                <p className="mt-1 text-xs text-muted">
                  {(() => {
                    const now = new Date();
                    const due = new Date(incident.due_at);
                    const diff = due.getTime() - now.getTime();
                    const hours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
                    const days = Math.floor(hours / 24);
                    
                    if (diff < 0) {
                      return (
                        <span className="text-red-400 font-medium">
                          ⚠️ Overdue by {days > 0 ? `${days}d ${hours % 24}h` : `${hours}h`}
                        </span>
                      );
                    } else if (diff < 24 * 60 * 60 * 1000) {
                      return (
                        <span className="text-yellow-400 font-medium">
                          ⏰ Due in {hours}h
                        </span>
                      );
                    } else {
                      return (
                        <span className="text-zinc-400">
                          Due in {days}d {hours % 24}h
                        </span>
                      );
                    }
                  })()}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              {myRole === "admin" && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? "Deleting…" : "Delete Incident"}
                </button>
              )}
              {myRole && myRole !== "viewer" && incident?.status !== "closed" && (
                <button
                  onClick={async () => {
                    setStatus("closed");
                    setSaving(true);
                    try {
                      const updated = await updateIncident(id, { status: "closed" });
                      setIncident(updated);
                      await createComment({ 
                        incidentId: id, 
                        content: "**System:** Status changed to **closed** - Incident marked as completed" 
                      });
                      await fetchComments();
                      setSuccessMsg("Incident marked as completed.");
                    } catch (err: unknown) {
                      setError(err instanceof Error ? err.message : "Failed to complete incident");
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Mark as Completed
                </button>
              )}
            </div>
            {myRole && myRole !== "viewer" && (
              <button
                onClick={handleUpdate}
                disabled={saving}
                className="rounded-xl bg-foreground px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            )}
          </div>
        </div>

        {/* Timeline Section */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Timeline</h2>

          {/* Add Entry Form */}
          {myRole && myRole !== "viewer" && (
            <div className="rounded-2xl bg-white shadow-sm p-5 mb-6">
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="eventType"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Event Type
                </label>
                <select
                  id="eventType"
                  value={newEventType}
                  onChange={(e) => setNewEventType(e.target.value)}
                  className="block w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Message
                </label>
                <textarea
                  id="timelineMessage"
                  rows={3}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Describe what happened or what action was taken…"
                  className="block w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground placeholder-zinc-500 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
                />
              </div>
              <button
                onClick={handleAddEntry}
                disabled={addingEntry || !newMessage.trim()}
                className="rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingEntry ? "Adding…" : "Add Entry"}
              </button>
            </div>
          </div>
          )}

          {/* Timeline Error */}
          {timelineError && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {timelineError}
            </div>
          )}

          {/* Timeline List */}
          {timelineLoading ? (
            <div className="flex items-center gap-3 text-muted py-6">
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
            <div className="rounded-xl border border-dashed border-border py-10 text-center">
              <p className="text-muted text-sm">No timeline entries yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {timeline.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl bg-white shadow-sm px-5 py-4"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        eventTypeColors[entry.event_type] ||
                        "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {entry.event_type.replace("_", " ")}
                    </span>
                    <span className="text-xs text-muted">
                      {profileMap[entry.created_by]?.display_name || entry.created_by?.slice(0, 8) + "…"}
                      {" · "}
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {entry.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Evidence Section */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Evidence</h2>

          {/* Upload Form */}
          {myRole && myRole !== "viewer" && (
            <div className="rounded-2xl bg-white shadow-sm p-5 mb-6">
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="evidenceFile"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Select File
                </label>
                <input
                  id="evidenceFile"
                  type="file"
                  onChange={(e) =>
                    setSelectedFile(e.target.files?.[0] || null)
                  }
                  className="block w-full text-sm text-muted file:mr-4 file:rounded-xl file:border-0 file:bg-foreground file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:opacity-90 file:cursor-pointer file:transition"
                />
              </div>
              <button
                onClick={handleUpload}
                disabled={uploading || !selectedFile}
                className="rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? "Uploading…" : "Upload Evidence"}
              </button>
            </div>
          </div>
          )}

          {/* Evidence Error */}
          {evidenceError && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {evidenceError}
            </div>
          )}

          {/* Evidence List */}
          {evidenceLoading ? (
            <div className="flex items-center gap-3 text-muted py-6">
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
            <div className="rounded-xl border border-dashed border-border py-10 text-center">
              <p className="text-muted text-sm">No evidence uploaded yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {evidence.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center justify-between gap-4 rounded-xl bg-white shadow-sm px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {rec.file_name}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {rec.mime_type || "unknown type"}
                      {rec.size_bytes
                        ? ` · ${(rec.size_bytes / 1024).toFixed(1)} KB`
                        : ""}
                      {" · "}
                      Uploaded by {profileMap[rec.uploaded_by]?.display_name || rec.uploaded_by.slice(0, 8) + "…"}
                      {" · "}
                      {new Date(rec.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => handleOpenEvidence(rec)}
                      disabled={openingId === rec.id}
                      className="rounded-xl bg-foreground px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                      {openingId === rec.id ? "Opening…" : "Open"}
                    </button>
                    <button
                      onClick={() => handleCopyLink(rec)}
                      className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-background hover:text-foreground"
                    >
                      Copy Link
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comments Section */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Discussion</h2>

          {/* Add Comment Form */}
          {myRole && myRole !== "viewer" && (
            <div className="rounded-2xl bg-white shadow-sm p-5 mb-6">
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="commentContent"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    Add Comment (Markdown supported)
                  </label>
                  <textarea
                    id="commentContent"
                    rows={4}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write your comment here... You can use **bold**, *italic*, and other markdown formatting."
                    className="block w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground placeholder-zinc-500 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
                  />
                </div>
                <button
                  onClick={handleAddComment}
                  disabled={addingComment || !newComment.trim()}
                  className="rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingComment ? "Adding…" : "Add Comment"}
                </button>
              </div>
            </div>
          )}

          {/* Comments Error */}
          {commentsError && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {commentsError}
            </div>
          )}

          {/* Comments List */}
          {commentsLoading ? (
            <div className="flex items-center gap-3 text-muted py-6">
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
              <span className="text-sm">Loading comments…</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-10 text-center">
              <p className="text-muted text-sm">No comments yet. Start the discussion!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-xl bg-white shadow-sm px-5 py-4"
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="shrink-0">
                      {profileMap[comment.user_id]?.avatar_url ? (
                        <img
                          src={profileMap[comment.user_id].avatar_url || ""}
                          alt={profileMap[comment.user_id]?.display_name || "User"}
                          className="h-10 w-10 rounded-full object-cover border border-border"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center border border-border">
                          <span className="text-sm font-medium text-accent">
                            {(profileMap[comment.user_id]?.display_name || "?").charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Comment Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-foreground">
                            {profileMap[comment.user_id]?.display_name || comment.user_id.slice(0, 8) + "…"}
                          </span>
                          {profileMap[comment.user_id]?.role && (
                            <span className="text-xs text-muted">
                              {profileMap[comment.user_id].role}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted whitespace-nowrap">
                            {new Date(comment.created_at).toLocaleString()}
                            {comment.updated_at !== comment.created_at && (
                              <span className="ml-1 italic">(edited)</span>
                            )}
                          </span>
                          {(myRole === "admin" || comment.user_id === currentUserId) && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              disabled={deletingCommentId === comment.id}
                              className="text-xs text-red-500 hover:text-red-400 transition disabled:opacity-50"
                            >
                              {deletingCommentId === comment.id ? "Deleting…" : "Delete"}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {comment.content}
                        </ReactMarkdown>
                      </div>
                    </div>
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
