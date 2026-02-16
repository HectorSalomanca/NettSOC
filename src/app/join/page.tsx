"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/services/auth";
import { joinOrgByCode } from "@/services/invites";

export default function JoinPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950">
          <p className="text-zinc-400">Loading…</p>
        </div>
      }
    >
      <JoinPage />
    </Suspense>
  );
}

function JoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const session = await getSession();
        if (!session) {
          router.push("/login");
          return;
        }
        const codeParam = searchParams.get("code");
        if (codeParam) {
          setCode(codeParam);
        }
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router, searchParams]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setJoining(true);
    setError(null);
    try {
      await joinOrgByCode(code.trim().toUpperCase());
      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to join organization"
      );
    } finally {
      setJoining(false);
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
          <h1 className="text-2xl font-bold text-white mb-2">
            Join Organization
          </h1>
          <p className="text-sm text-zinc-500 mb-6">
            Enter the invite code you received to join an organization.
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-900/50 border border-red-700 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {success ? (
            <div className="rounded-lg bg-green-900/50 border border-green-700 px-4 py-3 text-sm text-green-300">
              Successfully joined! Redirecting to dashboard…
            </div>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label
                  htmlFor="code"
                  className="block text-sm font-medium text-zinc-300 mb-1"
                >
                  Invite Code
                </label>
                <input
                  id="code"
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. AB3K7XNP2Q"
                  className="block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-lg font-mono tracking-widest text-white placeholder-zinc-500 text-center focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={joining || !code.trim()}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {joining ? "Joining…" : "Join Organization"}
              </button>
            </form>
          )}

          <div className="mt-6 flex justify-center gap-4 text-xs">
            <Link
              href="/dashboard"
              className="text-zinc-500 transition hover:text-white"
            >
              Dashboard
            </Link>
            <Link
              href="/org"
              className="text-zinc-500 transition hover:text-white"
            >
              My Organizations
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
