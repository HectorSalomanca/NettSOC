"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/services/auth";
import { createIncident } from "@/services/incidents";

const SEVERITIES = ["low", "medium", "high", "critical"];
const STATUSES = ["open", "investigating", "contained", "eradicated", "closed"];

export default function NewIncidentPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [status, setStatus] = useState("open");
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        const session = await getSession();
        if (!session) {
          router.push("/login");
          return;
        }
      } catch {
        router.push("/login");
      } finally {
        setAuthLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createIncident({ title, summary, severity, status });
      router.push("/incidents");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to create incident"
      );
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
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
        <div className="mb-8">
          <Link
            href="/incidents"
            className="text-sm text-zinc-400 transition hover:text-white"
          >
            ← Back to Incidents
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-white">
            Create Incident
          </h1>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-900/50 border border-red-700 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-zinc-300"
            >
              Title
            </label>
            <input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Unauthorized access detected on web server"
              className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Summary */}
          <div>
            <label
              htmlFor="summary"
              className="block text-sm font-medium text-zinc-300"
            >
              Summary
            </label>
            <textarea
              id="summary"
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Describe the incident in detail…"
              className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
            />
          </div>

          {/* Severity + Status row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="severity"
                className="block text-sm font-medium text-zinc-300"
              >
                Severity
              </label>
              <select
                id="severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="status"
                className="block text-sm font-medium text-zinc-300"
              >
                Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating…" : "Create Incident"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
