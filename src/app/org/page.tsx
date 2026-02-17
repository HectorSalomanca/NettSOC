"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/services/auth";
import {
  createOrganization,
  getMyOrganizations,
  getActiveOrg,
  setActiveOrg,
  Organization,
} from "@/services/org";
import AppShell from "@/components/AppShell";

export default function OrgPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [newOrgName, setNewOrgName] = useState("");

  useEffect(() => {
    async function init() {
      try {
        const session = await getSession();
        if (!session) {
          router.push("/login");
          return;
        }
        const myOrgs = await getMyOrganizations();
        setOrgs(myOrgs);
        setActiveOrgId(getActiveOrg());
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Failed to load organizations"
        );
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setCreating(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const org = await createOrganization(newOrgName.trim());
      setNewOrgName("");
      setOrgs([...orgs, org]);
      setActiveOrgId(org.id);
      setSuccessMsg(`Organization "${org.name}" created successfully.`);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to create organization"
      );
    } finally {
      setCreating(false);
    }
  }

  function handleSetActive(orgId: string) {
    setActiveOrg(orgId);
    setActiveOrgId(orgId);
    setSuccessMsg("Active organization updated.");
  }

  return (
    <AppShell title="Organizations" subtitle="Manage your organizations">
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

      <div className="mx-auto max-w-2xl">
        {/* Create Organization */}
        <div className="mb-8 rounded-2xl bg-white shadow-sm p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">
            Create New Organization
          </h2>
          <form onSubmit={handleCreateOrg} className="space-y-3">
            <div>
              <label
                htmlFor="orgName"
                className="block text-sm font-medium text-foreground"
              >
                Organization Name
              </label>
              <input
                id="orgName"
                type="text"
                required
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="e.g. Acme Security Team"
                className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <button
              type="submit"
              disabled={creating || !newOrgName.trim()}
              className="rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? "Creating…" : "Create Organization"}
            </button>
          </form>
        </div>

        {/* Organizations List */}
        <div>
          <h2 className="text-base font-semibold text-foreground mb-4">
            Your Organizations
          </h2>
          {orgs.length === 0 ? (
            <div className="rounded-2xl bg-white shadow-sm border border-dashed border-border py-12 text-center">
              <p className="text-muted">
                No organizations yet. Create one above or{" "}
                <Link href="/join" className="text-accent hover:underline">join one</Link>.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {orgs.map((org) => (
                <div
                  key={org.id}
                  className={`flex items-center justify-between rounded-2xl px-5 py-4 transition shadow-sm ${
                    activeOrgId === org.id
                      ? "bg-accent-light border border-accent/20"
                      : "bg-white"
                  }`}
                >
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {org.name}
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                      Created {new Date(org.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeOrgId === org.id ? (
                      <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-white">
                        Active
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSetActive(org.id)}
                        className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-background hover:text-foreground"
                      >
                        Set Active
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
