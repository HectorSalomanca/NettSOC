"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/services/auth";
import { getActiveOrgDetails, Organization } from "@/services/org";
import { listPlaybooks, getPlaybookWithTasks, createPlaybook, addPlaybookTasks, Playbook, PlaybookWithTasks } from "@/services/playbooks";
import { getMyRoleInActiveOrg } from "@/services/members";
import AppShell from "@/components/AppShell";

export default function PlaybooksPage() {
  const router = useRouter();
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [selectedPlaybook, setSelectedPlaybook] = useState<PlaybookWithTasks | null>(null);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIncidentType, setNewIncidentType] = useState("");
  const [newSeverity, setNewSeverity] = useState("");
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

        const playbooksList = await listPlaybooks();
        setPlaybooks(playbooksList);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load playbooks");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  async function handleSelectPlaybook(playbookId: string) {
    try {
      const playbookWithTasks = await getPlaybookWithTasks(playbookId);
      setSelectedPlaybook(playbookWithTasks);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load playbook details");
    }
  }

  async function handleCreatePlaybook(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    setCreating(true);
    setError(null);
    try {
      const playbook = await createPlaybook({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        incident_type: newIncidentType || undefined,
        severity_trigger: newSeverity || undefined,
      });

      // Refresh list
      const playbooksList = await listPlaybooks();
      setPlaybooks(playbooksList);

      // Reset form
      setNewName("");
      setNewDescription("");
      setNewIncidentType("");
      setNewSeverity("");
      setShowCreateForm(false);

      // Select the new playbook
      handleSelectPlaybook(playbook.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create playbook");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <AppShell title="Playbooks" subtitle="Loading...">
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
    <AppShell title="Playbooks" subtitle={activeOrg ? activeOrg.name : "Response Procedures"}>
      {error && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Playbooks List */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl bg-white shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">Playbook Library</h2>
              {isAdmin && (
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
                >
                  {showCreateForm ? "Cancel" : "+ New"}
                </button>
              )}
            </div>

            {showCreateForm && (
              <form onSubmit={handleCreatePlaybook} className="mb-4 space-y-3 rounded-xl border border-border bg-background p-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Playbook Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Ransomware Response"
                    className="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Brief description..."
                    className="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={creating || !newName.trim()}
                  className="w-full rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Playbook"}
                </button>
              </form>
            )}

            {playbooks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-8 text-center">
                <p className="text-sm text-muted">No playbooks yet</p>
                {isAdmin && (
                  <p className="mt-1 text-xs text-muted">Click "+ New" to create one</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {playbooks.map((playbook) => (
                  <button
                    key={playbook.id}
                    onClick={() => handleSelectPlaybook(playbook.id)}
                    className={`w-full text-left rounded-lg px-3 py-2.5 transition ${
                      selectedPlaybook?.id === playbook.id
                        ? "bg-accent/10 border border-accent"
                        : "border border-border hover:bg-background"
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground">{playbook.name}</p>
                    {playbook.incident_type && (
                      <p className="mt-0.5 text-xs text-muted">{playbook.incident_type}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Playbook Details */}
        <div className="lg:col-span-2">
          {selectedPlaybook ? (
            <div className="rounded-2xl bg-white shadow-sm p-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground">{selectedPlaybook.name}</h2>
                {selectedPlaybook.description && (
                  <p className="mt-2 text-sm text-muted">{selectedPlaybook.description}</p>
                )}
                <div className="mt-3 flex items-center gap-3 text-xs text-muted">
                  {selectedPlaybook.incident_type && (
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-600">
                      {selectedPlaybook.incident_type}
                    </span>
                  )}
                  {selectedPlaybook.severity_trigger && (
                    <span className="rounded-full bg-orange-50 px-2.5 py-1 text-orange-600">
                      {selectedPlaybook.severity_trigger} severity
                    </span>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Tasks ({selectedPlaybook.tasks.length})
                </h3>
                {selectedPlaybook.tasks.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border py-8 text-center">
                    <p className="text-sm text-muted">No tasks defined yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedPlaybook.tasks.map((task, index) => (
                      <div
                        key={task.id}
                        className="rounded-xl border border-border bg-background p-4"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-foreground">
                                {task.title}
                                {task.required && (
                                  <span className="ml-2 text-xs text-red-500">*Required</span>
                                )}
                              </p>
                              {task.estimated_minutes && (
                                <span className="shrink-0 text-xs text-muted">
                                  ~{task.estimated_minutes}m
                                </span>
                              )}
                            </div>
                            {task.description && (
                              <p className="mt-1 text-xs text-muted">{task.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-white shadow-sm p-16 text-center">
              <svg className="mx-auto h-12 w-12 text-muted opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-4 text-sm font-medium text-foreground">Select a playbook</p>
              <p className="mt-1 text-xs text-muted">Choose a playbook from the list to view its tasks</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
