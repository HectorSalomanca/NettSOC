"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession, signOut } from "@/services/auth";
import {
  createOrganization,
  getMyOrganizations,
  getActiveOrg,
  setActiveOrg,
  Organization,
} from "@/services/org";

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

  async function handleSignOut() {
    try {
      await signOut();
      router.push("/login");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign out");
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

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Organizations</h1>
            <p className="text-sm text-zinc-500">Manage your organizations</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/incidents"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
            >
              Incidents
            </Link>
            <Link
              href="/join"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
            >
              Join Org
            </Link>
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
            >
              Sign Out
            </button>
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

        {/* Create Organization */}
        <div className="mb-8 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Create New Organization
          </h2>
          <form onSubmit={handleCreateOrg} className="space-y-3">
            <div>
              <label
                htmlFor="orgName"
                className="block text-sm font-medium text-zinc-300"
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
                className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={creating || !newOrgName.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? "Creating…" : "Create Organization"}
            </button>
          </form>
        </div>

        {/* Organizations List */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">
            Your Organizations
          </h2>
          {orgs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-700 py-12 text-center">
              <p className="text-zinc-500">
                No organizations yet. Create one above.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {orgs.map((org) => (
                <div
                  key={org.id}
                  className={`flex items-center justify-between rounded-lg border px-5 py-4 transition ${
                    activeOrgId === org.id
                      ? "border-indigo-600 bg-indigo-900/20"
                      : "border-zinc-800 bg-zinc-900"
                  }`}
                >
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      {org.name}
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Created {new Date(org.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeOrgId === org.id ? (
                      <span className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white">
                        Active
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSetActive(org.id)}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
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
    </div>
  );
}
