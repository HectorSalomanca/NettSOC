"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/services/auth";
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
import AppShell from "@/components/AppShell";

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

  const joinUrl =
    typeof window !== "undefined" && generatedCode
      ? `${window.location.origin}/join?code=${generatedCode}`
      : "";

  return (
    <AppShell title="Members" subtitle={activeOrg ? activeOrg.name : "Organization"}>
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

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-white px-5 py-4 shadow-sm animate-pulse">
              <div className="h-4 w-40 rounded bg-zinc-200" />
              <div className="mt-2 h-3 w-28 rounded bg-zinc-100" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Member List */}
          <div className="mb-8">
            <h2 className="text-base font-semibold text-foreground mb-4">
              Organization Members
            </h2>
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
              {members.map((member, idx) => (
                <div
                  key={member.id}
                  className={`flex items-center justify-between px-5 py-3.5 ${
                    idx !== 0 ? "border-t border-border" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {profileMap[member.user_id]?.display_name || "Unnamed User"}
                    </p>
                    <p className="text-xs text-muted">
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
                          className="rounded-xl border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
                        >
                          <option value="admin">Admin</option>
                          <option value="analyst">Analyst</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={removingId === member.id}
                          className="rounded-xl border border-red-200 px-2 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          {removingId === member.id ? "…" : "Remove"}
                        </button>
                      </>
                    ) : (
                      <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-muted">
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
            <div className="mb-8 rounded-2xl bg-white shadow-sm p-6">
              <h2 className="text-base font-semibold text-foreground mb-4">
                Create Invite
              </h2>
              <div className="grid gap-3 sm:grid-cols-3 mb-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">
                    Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(
                        e.target.value as "admin" | "analyst" | "viewer"
                      )
                    }
                    className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
                  >
                    <option value="admin">Admin</option>
                    <option value="analyst">Analyst</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">
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
                    className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">
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
                    className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
              <button
                onClick={handleCreateInvite}
                disabled={creatingInvite}
                className="rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {creatingInvite ? "Creating…" : "Generate Invite"}
              </button>

              {/* Generated Code */}
              {generatedCode && (
                <div className="mt-4 rounded-xl border border-accent/20 bg-accent-light p-4">
                  <p className="text-xs font-medium text-accent mb-2">
                    Invite Code
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-xl bg-white px-3 py-2 text-sm font-mono text-foreground">
                      {generatedCode}
                    </code>
                    <button
                      onClick={() => copyToClipboard(generatedCode)}
                      className="rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted transition hover:bg-background hover:text-foreground"
                    >
                      Copy Code
                    </button>
                  </div>
                  {joinUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      <code className="flex-1 rounded-xl bg-white px-3 py-2 text-xs font-mono text-muted truncate">
                        {joinUrl}
                      </code>
                      <button
                        onClick={() => copyToClipboard(joinUrl)}
                        className="rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted transition hover:bg-background hover:text-foreground"
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
              <h2 className="text-base font-semibold text-foreground mb-4">
                Existing Invites
              </h2>
              <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
                {invites.map((invite, idx) => (
                  <div
                    key={invite.id}
                    className={`flex items-center justify-between px-5 py-3.5 ${
                      idx !== 0 ? "border-t border-border" : ""
                    } ${!invite.is_active ? "opacity-60" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono text-foreground">
                          {invite.code}
                        </code>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-muted">
                          {invite.role}
                        </span>
                        {!invite.is_active && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-500">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted">
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
                        className="rounded-xl border border-border px-2 py-1 text-xs font-medium text-muted transition hover:bg-background hover:text-foreground"
                      >
                        Copy
                      </button>
                      {invite.is_active && (
                        <button
                          onClick={() => handleDeactivateInvite(invite.id)}
                          className="rounded-xl border border-red-200 px-2 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50"
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
        </>
      )}
    </AppShell>
  );
}
