"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession, signOut } from "@/services/auth";
import { getMyProfile, upsertMyProfile, Profile } from "@/services/profiles";

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
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8">
          <h1 className="text-2xl font-bold text-white mb-2">Profile</h1>
          <p className="text-sm text-zinc-500 mb-6">
            Set your display name so other members can identify you.
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-900/50 border border-red-700 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="mb-4 rounded-lg bg-green-900/50 border border-green-700 px-4 py-3 text-sm text-green-300">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                Email
              </label>
              <p className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-400">
                {email}
              </p>
            </div>
            <div>
              <label
                htmlFor="displayName"
                className="block text-sm font-medium text-zinc-300 mb-1"
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
                className="block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={saving || !displayName.trim()}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Profile"}
            </button>
          </form>

          <div className="mt-6 flex justify-center gap-4 text-xs">
            <Link
              href="/dashboard"
              className="text-zinc-500 transition hover:text-white"
            >
              Dashboard
            </Link>
            <Link
              href="/incidents"
              className="text-zinc-500 transition hover:text-white"
            >
              Incidents
            </Link>
            <button
              onClick={handleSignOut}
              className="text-zinc-500 transition hover:text-white"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
