"use client";

import { useState } from "react";
import Link from "next/link";

export interface SongCard {
  id: string;
  title: string;
  status: string;
  version_count: number;
  has_lyrics: boolean;
  created_at: string;
  updated_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-surface-alt text-muted",
  "in-progress": "bg-amber-900/60 text-amber-300",
  finished: "bg-emerald-900/60 text-emerald-300",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  "in-progress": "In Progress",
  finished: "Finished",
};

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function SongListItem({
  song,
  onDeleted,
}: {
  song: SongCard;
  onDeleted: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/songs/${song.id}`, { method: "DELETE" });
    if (res.ok) {
      onDeleted(song.id);
    } else {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="relative flex items-stretch rounded-lg glass glass-hover transition">
      <Link
        href={`/songs/${song.id}`}
        className="flex-1 min-w-0 text-left px-4 py-3"
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-foreground font-medium truncate mr-2">
            {song.title}
          </h3>
          <span
            className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[song.status] ?? STATUS_COLORS.draft}`}
          >
            {STATUS_LABELS[song.status] ?? song.status}
          </span>
        </div>
        <div className="flex items-center gap-3 text-muted-dim text-xs">
          <span>
            {song.version_count > 0
              ? `${song.version_count} ${song.version_count === 1 ? "version" : "versions"}`
              : "Lyrics only"}
          </span>
          {song.has_lyrics && (
            <span className="flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 20h9" />
                <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
              </svg>
              Lyrics
            </span>
          )}
          <span>Updated {formatDate(song.updated_at)}</span>
        </div>
      </Link>
      <div className="flex shrink-0 items-center pr-3 pl-1">
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-2 text-muted-dim hover:text-red-400 transition rounded-lg"
            aria-label={`Delete ${song.title}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs font-semibold px-2 py-1 rounded-md bg-red-900/60 text-red-300 hover:bg-red-900/80 transition disabled:opacity-50"
              aria-label={`Confirm delete ${song.title}`}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              className="text-xs px-2 py-1 rounded-md glass text-muted hover:text-foreground transition disabled:opacity-50"
              aria-label="Cancel delete"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
