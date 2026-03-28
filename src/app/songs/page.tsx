"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { NewSongModal } from "@/components/new-song-modal";

interface MemberInfo {
  nickname: string;
}

interface BandInfo {
  name: string;
  invite_token: string;
}

interface SongCard {
  id: string;
  title: string;
  status: string;
  version_count: number;
  has_lyrics: boolean;
  created_at: string;
  updated_at: string;
}

type SortOption = "updated" | "title" | "created";
type StatusFilter = "all" | "draft" | "in-progress" | "finished";

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

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "in-progress", label: "In Progress" },
  { value: "finished", label: "Finished" },
];

export default function SongsPage() {
  const router = useRouter();
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [band, setBand] = useState<BandInfo | null>(null);
  const [songs, setSongs] = useState<SongCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("updated");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    const [authRes, songsRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/songs"),
    ]);
    const authData = await authRes.json();
    const songsData = await songsRes.json();

    setMember(authData.member);
    setBand(authData.band);
    setSongs(songsData.songs ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const hasFiltersActive = statusFilter !== "all" || debouncedQuery !== "";

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-lg mx-auto w-full">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">{band?.name ?? "Loading..."}</h1>
          {member && (
            <p className="text-muted text-sm">
              Logged in as {member.nickname}
            </p>
          )}
        </div>
        <button
          onClick={() => router.push("/settings")}
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
        </button>
      </header>

      {!loading && songs.length === 0 && (
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

      {!loading && songs.length > 0 && (
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
              className="w-full rounded-lg bg-surface border border-border pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-dim focus:outline-none focus:ring-1 focus:ring-accent/40"
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
                      : "bg-surface text-muted border border-border hover:border-border-light"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="shrink-0 text-xs bg-surface border border-border text-muted rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent/40"
            >
              <option value="updated">Last Updated</option>
              <option value="title">Title A–Z</option>
              <option value="created">Date Created</option>
            </select>
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
                <button
                  key={song.id}
                  onClick={() => router.push(`/songs/${song.id}`)}
                  className="w-full text-left rounded-lg bg-surface border border-border px-4 py-3 hover:bg-surface-alt hover:border-border-light transition"
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
                </button>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
              <p className="text-muted">No songs match your filters.</p>
            </div>
          )}

        </>
      )}

      {showModal && <NewSongModal onClose={() => setShowModal(false)} />}
    </main>
  );
}
