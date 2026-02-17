"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/services/auth";
import { listNotes, createNote, deleteNote } from "@/services/notes";
import AppShell from "@/components/AppShell";

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

  return (
    <AppShell title="Notes" subtitle="Your personal notes">
      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
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
            className="flex-1 rounded-xl border border-border bg-white px-4 py-2.5 text-foreground placeholder-muted shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            type="submit"
            disabled={creating || !newNote.trim()}
            className="rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? "Adding…" : "Add Note"}
          </button>
        </div>
      </form>

      {/* Notes List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-white px-5 py-4 shadow-sm animate-pulse">
              <div className="h-4 w-64 rounded bg-zinc-200" />
              <div className="mt-2 h-3 w-32 rounded bg-zinc-100" />
            </div>
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-sm border border-dashed border-border py-12 text-center">
          <p className="text-muted">No notes yet. Create your first one above.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
          {notes.map((note, idx) => (
            <div
              key={note.id}
              className={`flex items-start justify-between gap-4 px-5 py-4 ${
                idx !== 0 ? "border-t border-border" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-foreground whitespace-pre-wrap break-words text-sm">
                  {note.content}
                </p>
                <p className="mt-1.5 text-xs text-muted">
                  {new Date(note.created_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => handleDelete(note.id)}
                disabled={deletingId === note.id}
                className="shrink-0 rounded-xl px-3 py-1.5 text-xs text-red-500 transition hover:bg-red-50 disabled:opacity-50"
              >
                {deletingId === note.id ? "…" : "Delete"}
              </button>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
