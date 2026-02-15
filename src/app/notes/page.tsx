"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSession, signOut } from "@/services/auth";
import { listNotes, createNote, deleteNote } from "@/services/notes";

interface Note {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
}

export default function NotesPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    try {
      const data = await listNotes();
      setNotes(data as Note[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load notes");
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const session = await getSession();
        if (!session) {
          router.push("/login");
          return;
        }
        setUserId(session.user.id);
        await fetchNotes();
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router, fetchNotes]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newNote.trim() || !userId) return;
    setCreating(true);
    setError(null);
    try {
      await createNote(newNote.trim(), userId);
      setNewNote("");
      await fetchNotes();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create note");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(noteId: string) {
    setDeletingId(noteId);
    setError(null);
    try {
      await deleteNote(noteId);
      await fetchNotes();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete note");
    } finally {
      setDeletingId(null);
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
    <div className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">Your Notes</h1>
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
          >
            Sign Out
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-900/50 border border-red-700 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Create Note */}
        <form onSubmit={handleCreate} className="mb-8">
          <div className="flex gap-3">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Write a new note…"
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={creating || !newNote.trim()}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? "Adding…" : "Add Note"}
            </button>
          </div>
        </form>

        {/* Notes List */}
        {notes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-700 py-12 text-center">
            <p className="text-zinc-500">No notes yet. Create your first one above.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {notes.map((note) => (
              <li
                key={note.id}
                className="group flex items-start justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4 transition hover:border-zinc-700"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-white whitespace-pre-wrap break-words">
                    {note.content}
                  </p>
                  <p className="mt-1.5 text-xs text-zinc-500">
                    {new Date(note.created_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(note.id)}
                  disabled={deletingId === note.id}
                  className="shrink-0 rounded-md px-3 py-1.5 text-sm text-zinc-500 transition hover:bg-red-900/50 hover:text-red-400 disabled:opacity-50"
                >
                  {deletingId === note.id ? "…" : "Delete"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
