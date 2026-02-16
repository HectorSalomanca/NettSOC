"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp, getSession } from "@/services/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await signIn(email, password);
      router.push("/incidents");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const data = await signUp(email, password);
      if (data.session) {
        router.push("/incidents");
      } else {
        setMessage("Check your email to confirm your account, then sign in.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            NettSOC
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Cybersecurity Incident Tracker
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSignIn}>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-300"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-300"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-900/50 border border-red-700 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-lg bg-green-900/50 border border-green-700 px-4 py-3 text-sm text-green-300">
              {message}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Loading…" : "Sign In"}
            </button>
            <button
              type="button"
              onClick={handleSignUp}
              disabled={loading}
              className="flex-1 rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Loading…" : "Sign Up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
