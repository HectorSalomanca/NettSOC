"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession, signOut } from "@/services/auth";
import { getActiveOrgDetails, Organization } from "@/services/org";
import {
  listMembers,
  updateMemberRole,
  removeMember,
  getMyRoleInActiveOrg,
  MemberRecord,
} from "@/services/members";
import {
  createInvite,
  listInvites,
  deactivateInvite,
  InviteRecord,
} from "@/services/invites";
import { getProfilesByIds, Profile } from "@/services/profiles";

export default function MembersPage() {
  const router = useRouter();
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [profileMap, setProfileMap] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Invite creation state
  const [inviteRole, setInviteRole] = useState<"admin" | "analyst" | "viewer">(
    "analyst"
  );
  const [inviteMaxUses, setInviteMaxUses] = useState(1);
  const [inviteExpDays, setInviteExpDays] = useState(7);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  // Role change state
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

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

        const [role, memberList] = await Promise.all([
          getMyRoleInActiveOrg(),
          listMembers(),
        ]);
        setMyRole(role);
        setMembers(memberList);

        const userIds = memberList.map((m) => m.user_id);
        const profiles = await getProfilesByIds(userIds);
        setProfileMap(profiles);

        if (role === "admin") {
          const inviteList = await listInvites();
          setInvites(inviteList);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  async function handleCreateInvite() {
    setCreatingInvite(true);
    setError(null);
    setSuccessMsg(null);
    setGeneratedCode(null);
    try {
      const invite = await createInvite({
        role: inviteRole,
        expiresInDays: inviteExpDays,
        maxUses: inviteMaxUses,
      });
      setGeneratedCode(invite.code);
      setSuccessMsg("Invite created successfully!");
      const inviteList = await listInvites();
      setInvites(inviteList);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to create invite"
      );
    } finally {
      setCreatingInvite(false);
    }
  }

  async function handleRoleChange(memberId: string, newRole: string) {
    setUpdatingId(memberId);
    setError(null);
    setSuccessMsg(null);
    try {
      await updateMemberRole(
        memberId,
        newRole as "admin" | "analyst" | "viewer"
      );
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
      setSuccessMsg("Role updated.");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to update role"
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm("Remove this member from the organization?")) return;
    setRemovingId(memberId);
    setError(null);
    setSuccessMsg(null);
    try {
      await removeMember(memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setSuccessMsg("Member removed.");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to remove member"
      );
    } finally {
      setRemovingId(null);
    }
  }

  async function handleDeactivateInvite(inviteId: string) {
    setError(null);
    try {
      await deactivateInvite(inviteId);
      setInvites((prev) =>
        prev.map((i) =>
          i.id === inviteId ? { ...i, is_active: false } : i
        )
      );
      setSuccessMsg("Invite deactivated.");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to deactivate invite"
      );
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setSuccessMsg("Copied to clipboard!");
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

  const joinUrl =
    typeof window !== "undefined" && generatedCode
      ? `${window.location.origin}/join?code=${generatedCode}`
      : "";

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Members</h1>
            <p className="text-sm text-zinc-500">
              {activeOrg ? activeOrg.name : "Organization"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
            >
              Dashboard
            </Link>
            <Link
              href="/incidents"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
            >
              Incidents
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

        {/* Member List */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">
            Organization Members
          </h2>
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">
                    {profileMap[member.user_id]?.display_name || "Unnamed User"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {member.user_id.slice(0, 8)}… · Joined{" "}
                    {new Date(member.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  {isAdmin ? (
                    <>
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleRoleChange(member.id, e.target.value)
                        }
                        disabled={updatingId === member.id}
                        className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                      >
                        <option value="admin">Admin</option>
                        <option value="analyst">Analyst</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={removingId === member.id}
                        className="rounded-lg border border-red-800 px-2 py-1 text-xs font-medium text-red-400 transition hover:bg-red-900/50 disabled:opacity-50"
                      >
                        {removingId === member.id ? "…" : "Remove"}
                      </button>
                    </>
                  ) : (
                    <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
                      {member.role}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Admin-only: Create Invite */}
        {isAdmin && (
          <div className="mb-8 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Create Invite
            </h2>
            <div className="grid gap-3 sm:grid-cols-3 mb-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(
                      e.target.value as "admin" | "analyst" | "viewer"
                    )
                  }
                  className="block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="admin">Admin</option>
                  <option value="analyst">Analyst</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  Max Uses
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={inviteMaxUses}
                  onChange={(e) =>
                    setInviteMaxUses(parseInt(e.target.value) || 1)
                  }
                  className="block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  Expires (days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={inviteExpDays}
                  onChange={(e) =>
                    setInviteExpDays(parseInt(e.target.value) || 7)
                  }
                  className="block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
            <button
              onClick={handleCreateInvite}
              disabled={creatingInvite}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {creatingInvite ? "Creating…" : "Generate Invite"}
            </button>

            {/* Generated Code */}
            {generatedCode && (
              <div className="mt-4 rounded-lg border border-indigo-700 bg-indigo-900/30 p-4">
                <p className="text-xs font-medium text-indigo-300 mb-2">
                  Invite Code
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-zinc-800 px-3 py-2 text-sm font-mono text-white">
                    {generatedCode}
                  </code>
                  <button
                    onClick={() => copyToClipboard(generatedCode)}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
                  >
                    Copy Code
                  </button>
                </div>
                {joinUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <code className="flex-1 rounded bg-zinc-800 px-3 py-2 text-xs font-mono text-zinc-400 truncate">
                      {joinUrl}
                    </code>
                    <button
                      onClick={() => copyToClipboard(joinUrl)}
                      className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
                    >
                      Copy Link
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Admin-only: Existing Invites */}
        {isAdmin && invites.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">
              Existing Invites
            </h2>
            <div className="space-y-2">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                    invite.is_active
                      ? "border-zinc-800 bg-zinc-900"
                      : "border-zinc-800/50 bg-zinc-900/50 opacity-60"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-white">
                        {invite.code}
                      </code>
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                        {invite.role}
                      </span>
                      {!invite.is_active && (
                        <span className="rounded-full bg-red-900/50 px-2 py-0.5 text-xs text-red-400">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      Uses: {invite.uses}/{invite.max_uses}
                      {invite.expires_at &&
                        ` · Expires ${new Date(
                          invite.expires_at
                        ).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <button
                      onClick={() => copyToClipboard(invite.code)}
                      className="rounded-lg border border-zinc-700 px-2 py-1 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
                    >
                      Copy
                    </button>
                    {invite.is_active && (
                      <button
                        onClick={() => handleDeactivateInvite(invite.id)}
                        className="rounded-lg border border-red-800 px-2 py-1 text-xs font-medium text-red-400 transition hover:bg-red-900/50"
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
