"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/services/auth";
import { getActiveOrgDetails, Organization } from "@/services/org";
import { listTemplates, createTemplate, IncidentTemplate } from "@/services/templates";
import { listPlaybooks, Playbook } from "@/services/playbooks";
import { getMyRoleInActiveOrg } from "@/services/members";
import AppShell from "@/components/AppShell";

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<IncidentTemplate[]>([]);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [newSeverity, setNewSeverity] = useState("medium");
  const [newStatus, setNewStatus] = useState("open");
  const [newPlaybookId, setNewPlaybookId] = useState("");
  const [creating, setCreating] = useState(false);

  const isAdmin = myRole === "admin";

  useEffect(() => {
    async function init() {
      try {
        const session = await getSession();
        if (!session) {
          router.push("/login");
          return;
        }
        const org = await getActiveOrgDetails();
        if (!org) {
          router.push("/org");
          return;
        }
        setActiveOrg(org);
        const role = await getMyRoleInActiveOrg();
        setMyRole(role);

        const [templatesList, playbooksList] = await Promise.all([
          listTemplates(),
          listPlaybooks(),
        ]);
        setTemplates(templatesList);
        setPlaybooks(playbooksList);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load templates");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  async function handleCreateTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newTitle.trim()) return;

    setCreating(true);
    setError(null);
    try {
      await createTemplate({
        name: newName.trim(),
        title_template: newTitle.trim(),
        summary_template: newSummary.trim() || undefined,
        default_severity: newSeverity,
        default_status: newStatus,
        default_playbook_id: newPlaybookId || undefined,
      });

      // Refresh list
      const templatesList = await listTemplates();
      setTemplates(templatesList);

      // Reset form
      setNewName("");
      setNewTitle("");
      setNewSummary("");
      setNewSeverity("medium");
      setNewStatus("open");
      setNewPlaybookId("");
      setShowCreateForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create template");
    } finally {
      setCreating(false);
    }
  }

  async function handleUseTemplate(template: IncidentTemplate) {
    router.push(`/incidents/new?template=${template.id}`);
  }

  if (loading) {
    return (
      <AppShell title="Templates" subtitle="Loading...">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-white px-5 py-4 shadow-sm animate-pulse">
              <div className="h-4 w-48 rounded bg-zinc-200" />
              <div className="mt-2 h-3 w-32 rounded bg-zinc-100" />
            </div>
          ))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Incident Templates" subtitle={activeOrg ? activeOrg.name : "Quick Create Templates"}>
      {error && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {isAdmin && (
        <div className="mb-6">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {showCreateForm ? "Cancel" : "+ New Template"}
          </button>
        </div>
      )}

      {showCreateForm && (
        <div className="mb-6 rounded-2xl bg-white shadow-sm p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Create Template</h2>
          <form onSubmit={handleCreateTemplate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Phishing Email"
                  className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Incident Title Template *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Phishing: [Subject]"
                  className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Summary Template
              </label>
              <textarea
                rows={3}
                value={newSummary}
                onChange={(e) => setNewSummary(e.target.value)}
                placeholder="Pre-filled summary text..."
                className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none resize-y"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Default Severity
                </label>
                <select
                  value={newSeverity}
                  onChange={(e) => setNewSeverity(e.target.value)}
                  className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Default Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
                >
                  <option value="open">Open</option>
                  <option value="investigating">Investigating</option>
                  <option value="contained">Contained</option>
                  <option value="eradicated">Eradicated</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Default Playbook
                </label>
                <select
                  value={newPlaybookId}
                  onChange={(e) => setNewPlaybookId(e.target.value)}
                  className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
                >
                  <option value="">None</option>
                  {playbooks.map((pb) => (
                    <option key={pb.id} value={pb.id}>
                      {pb.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={creating || !newName.trim() || !newTitle.trim()}
              className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Template"}
            </button>
          </form>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-sm border border-dashed border-border py-16 text-center">
          <p className="text-muted">No templates yet</p>
          {isAdmin && (
            <p className="mt-1 text-xs text-muted">Create your first template to speed up incident creation</p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="rounded-2xl bg-white shadow-sm p-5 hover:shadow-md transition"
            >
              <div className="mb-3">
                <h3 className="text-base font-semibold text-foreground">{template.name}</h3>
                <p className="mt-1 text-sm text-muted line-clamp-2">{template.title_template}</p>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  template.default_severity === "critical" ? "bg-red-50 text-red-600" :
                  template.default_severity === "high" ? "bg-orange-50 text-orange-600" :
                  template.default_severity === "medium" ? "bg-amber-50 text-amber-600" :
                  "bg-blue-50 text-blue-600"
                }`}>
                  {template.default_severity}
                </span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                  {template.default_status}
                </span>
              </div>

              <button
                onClick={() => handleUseTemplate(template)}
                className="w-full rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Use Template
              </button>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
