"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NewSongModal } from "@/components/new-song-modal";
import { SongListItem, type SongCard } from "@/components/song-list-item";

type SortOption = "updated" | "title" | "created";
type StatusFilter = "all" | "draft" | "in-progress" | "finished";

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "in-progress", label: "In Progress" },
  { value: "finished", label: "Finished" },
];

export function SongsView({
  initialSongs,
  bandName,
  nickname,
}: {
  initialSongs: SongCard[];
  bandName: string;
  nickname: string;
}) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  // Songs render from server props. Deletions are tracked locally for an
  // instant UI update; router.refresh() re-syncs the server data.
  const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(new Set());
  const songs = useMemo(
    () => initialSongs.filter((s) => !deletedIds.has(s.id)),
    [initialSongs, deletedIds]
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("updated");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showSort, setShowSort] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const filteredSongs = useMemo(() => {
    let result = songs;

    if (statusFilter !== "all") {
      result = result.filter((s) => s.status === statusFilter);
    }

    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      result = result.filter((s) => s.title.toLowerCase().includes(q));
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "title":
          return a.title.localeCompare(b.title);
        case "created":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "updated":
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });

    return result;
  }, [songs, statusFilter, debouncedQuery, sortBy]);

  const handleSongDeleted = useCallback((id: string) => {
    setDeletedIds((prev) => new Set(prev).add(id));
    router.refresh();
  }, [router]);

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-lg mx-auto w-full">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">{bandName}</h1>
          <p className="text-muted text-sm">
            Logged in as {nickname}
          </p>
        </div>
        {/* Link (not router.push) so the settings route is prefetched */}
        <Link
          href="/settings"
          className="text-muted hover:text-foreground transition p-2"
          aria-label="Band settings"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </Link>
      </header>

      {songs.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="text-muted mb-6">No songs yet. Start creating!</p>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-accent text-white font-semibold py-3 px-6 hover:bg-accent-hover transition"
          >
            + New Song
          </button>
        </div>
      )}

      {songs.length > 0 && (
        <>
          {/* Search */}
          <div className="relative mb-4">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-dim"
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
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Search songs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg glass pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-dim focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
          </div>

          {/* Filter pills + Sort */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex gap-1.5 overflow-x-auto">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition ${
                    statusFilter === opt.value
                      ? "bg-accent text-white font-semibold"
                      : "glass text-muted hover:border-white/[0.12]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="relative shrink-0">
              <button
                onClick={() => setShowSort(!showSort)}
                className="p-2 text-muted hover:text-foreground transition rounded-lg hover:bg-surface"
                aria-label="Sort options"
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
                  <path d="m3 16 4 4 4-4" />
                  <path d="M7 20V4" />
                  <path d="m21 8-4-4-4 4" />
                  <path d="M17 4v16" />
                </svg>
              </button>
              {showSort && (
                <div className="absolute right-0 top-10 z-10 glass rounded-lg shadow-lg py-1 min-w-[150px]">
                  {([
                    { value: "updated", label: "Last Updated" },
                    { value: "title", label: "Title A–Z" },
                    { value: "created", label: "Date Created" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setSortBy(opt.value);
                        setShowSort(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs transition ${
                        sortBy === opt.value
                          ? "text-foreground font-semibold bg-surface-alt"
                          : "text-muted hover:bg-surface-alt hover:text-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="w-full rounded-lg bg-accent text-white font-semibold py-3 px-4 hover:bg-accent-hover transition mb-4"
          >
            + New Song
          </button>

          {/* Song list */}
          {filteredSongs.length > 0 ? (
            <div className="flex flex-col gap-3">
              {filteredSongs.map((song) => (
                <SongListItem
                  key={song.id}
                  song={song}
                  onDeleted={handleSongDeleted}
                />
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
              <p className="text-muted">No songs match your filters.</p>
            </div>
          )}

        </>
      )}

      {showModal && (
        <NewSongModal
          onClose={() => {
            setShowModal(false);
            // Re-run the server fetch so a song created in the modal appears
            router.refresh();
          }}
        />
      )}
    </main>
  );
}
