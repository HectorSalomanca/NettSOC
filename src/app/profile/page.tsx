"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/services/auth";
import { getMyProfile, upsertMyProfile, Profile } from "@/services/profiles";
import AppShell from "@/components/AppShell";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const session = await getSession();
        if (!session) {
          router.push("/login");
          return;
        }
        setEmail(session.user.email || "");
        const p = await getMyProfile();
        if (p) {
          setProfile(p);
          setDisplayName(p.display_name);
        }
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const updated = await upsertMyProfile(displayName.trim());
      setProfile(updated);
      setSuccessMsg("Profile saved!");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Profile" subtitle="Manage your account settings">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl bg-white shadow-sm p-8">
          <h2 className="text-lg font-semibold text-foreground mb-1">Your Profile</h2>
          <p className="text-sm text-muted mb-6">
            Set your display name so other members can identify you.
          </p>

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-600">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Email
              </label>
              <p className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted">
                {email}
              </p>
            </div>
            <div>
              <label
                htmlFor="displayName"
                className="block text-sm font-medium text-foreground mb-1"
              >
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Jane Smith"
                className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <button
              type="submit"
              disabled={saving || !displayName.trim()}
              className="w-full rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Profile"}
            </button>
          </form>

          <div className="mt-6 flex justify-center gap-4 text-xs">
            <Link
              href="/dashboard"
              className="text-muted transition hover:text-foreground"
            >
              Dashboard
            </Link>
            <Link
              href="/incidents"
              className="text-muted transition hover:text-foreground"
            >
              Incidents
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
