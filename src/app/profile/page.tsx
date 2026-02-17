"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/services/auth";
import { getMyProfile, upsertMyProfile, uploadAvatar, Profile } from "@/services/profiles";
import AppShell from "@/components/AppShell";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [bio, setBio] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [email, setEmail] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
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
          setDisplayName(p.display_name || "");
          setFullName(p.full_name || "");
          setRole(p.role || "");
          setBio(p.bio || "");
          setTimezone(p.timezone || "UTC");
          setAvatarPreview(p.avatar_url);
        }
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      let avatarUrl = profile?.avatar_url || null;
      
      // Upload avatar if changed
      if (avatarFile) {
        setUploadingAvatar(true);
        avatarUrl = await uploadAvatar(avatarFile);
        setUploadingAvatar(false);
      }

      const updated = await upsertMyProfile({
        display_name: displayName.trim(),
        full_name: fullName.trim(),
        role: role.trim(),
        bio: bio.trim(),
        timezone,
        avatar_url: avatarUrl,
      });
      setProfile(updated);
      setAvatarFile(null);
      setSuccessMsg("Profile saved!");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
      setUploadingAvatar(false);
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

          <form onSubmit={handleSave} className="space-y-5">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar"
                    className="h-24 w-24 rounded-full object-cover border-2 border-border"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-full bg-accent/10 flex items-center justify-center border-2 border-border">
                    <svg className="w-12 h-12 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>
              <label className="cursor-pointer rounded-xl bg-background border border-border px-4 py-2 text-xs font-medium text-foreground transition hover:bg-card-hover">
                {uploadingAvatar ? "Uploading..." : "Change Avatar"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                  disabled={uploadingAvatar}
                />
              </label>
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Email
              </label>
              <p className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted">
                {email}
              </p>
            </div>

            {/* Display Name */}
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-foreground mb-1">
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. jsmith"
                className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-foreground mb-1">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Jane Smith"
                className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Role */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-foreground mb-1">
                Role / Title
              </label>
              <input
                id="role"
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. SOC Analyst, IR Lead, Admin"
                className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Bio */}
            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-foreground mb-1">
                Bio
              </label>
              <textarea
                id="bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A short bio about yourself (1-2 paragraphs)"
                className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
              />
            </div>

            {/* Timezone */}
            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-foreground mb-1">
                Timezone
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris</option>
                <option value="Asia/Tokyo">Tokyo</option>
                <option value="Australia/Sydney">Sydney</option>
              </select>
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
