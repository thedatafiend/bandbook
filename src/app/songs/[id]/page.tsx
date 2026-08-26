"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { SongDetailSkeleton } from "@/components/skeletons/song-detail-skeleton";
import { cacheGet, cacheSet } from "@/lib/cache";
import type { SongDetail } from "@/components/song-detail/shared";
import {
  EditableTitle,
  EditableStatus,
  EditableBpm,
} from "@/components/song-detail/editable-fields";
import { AudioPlayer } from "@/components/song-detail/audio-player";
import { VersionsSection } from "@/components/song-detail/versions-section";

// The lyrics composer (drag-and-drop editor, autosave, revision history)
// is a large chunk that only matters when the Lyrics tab is active — load
// it on demand instead of shipping it with the page.
const LyricsComposer = dynamic(
  () => import("@/components/song-detail/lyrics-composer"),
  {
    loading: () => (
      <p className="text-muted-dim text-sm text-center py-8">Loading...</p>
    ),
  }
);

export default function SongDetailPage() {
  const router = useRouter();
  const params = useParams();
  const songId = params.id as string;
  const [song, setSong] = useState<SongDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [activeTab, setActiveTab] = useState<"versions" | "lyrics">("versions");
  const [playerVersionId, setPlayerVersionId] = useState<string | null>(null);

  const applySong = useCallback((s: SongDetail | null) => {
    setSong(s);
    if (s) {
      // Default tab: Lyrics if no audio versions, else Versions
      if (s.versions.length === 0) {
        setActiveTab("lyrics");
      }
      // Set player to current version
      const current = s.versions.find((v) => v.is_current);
      if (current) setPlayerVersionId(current.id);
    }
    setLoading(false);
  }, []);

  const fetchSong = useCallback(async () => {
    // The song endpoint verifies auth itself — a 401 means the session is
    // gone, so no separate /api/auth/me round trip is needed.
    const res = await fetch(`/api/songs/${songId}`);

    if (res.status === 401) {
      setSessionExpired(true);
      setLoading(false);
      return;
    }

    setSessionExpired(false);
    const data = await res.json();
    const s = data.song as SongDetail | null;
    if (s) cacheSet(`song:${songId}`, s);
    applySong(s);
  }, [songId, applySong]);

  useEffect(() => {
    // Show cached data immediately, then revalidate in background
    const cached = cacheGet<SongDetail>(`song:${songId}`);
    if (cached) {
      applySong(cached.data);
      if (cached.stale) fetchSong();
    } else {
      fetchSong();
    }
  }, [songId, applySong, fetchSong]);

  if (loading) {
    return (
      <main>
        <SongDetailSkeleton />
      </main>
    );
  }

  if (sessionExpired) {
    router.push("/sign-in");
    return null;
  }

  if (!song) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center">
        <p className="text-muted mb-4">Song not found</p>
        <button
          onClick={() => router.back()}
          className="text-foreground hover:underline"
        >
          Back to catalog
        </button>
      </main>
    );
  }

  const playerVersion = playerVersionId
    ? song.versions.find((v) => v.id === playerVersionId) ?? null
    : null;

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-lg mx-auto w-full">
      {/* Header */}
      <header className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="text-muted hover:text-foreground transition"
          aria-label="Back to songs"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <EditableTitle
            value={song.title}
            onSave={async (newTitle) => {
              const res = await fetch(`/api/songs/${song.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: newTitle }),
              });
              if (res.ok) {
                setSong((s) => s ? { ...s, title: newTitle } : s);
              }
              return res.ok;
            }}
          />
          <div className="flex items-center gap-2 text-muted-dim text-sm">
            <EditableStatus
              value={song.status}
              onSave={async (newStatus) => {
                const res = await fetch(`/api/songs/${song.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: newStatus }),
                });
                if (res.ok) {
                  setSong((s) => s ? { ...s, status: newStatus } : s);
                }
                return res.ok;
              }}
            />
            <span aria-hidden="true">·</span>
            <EditableBpm
              value={song.bpm}
              onSave={async (newBpm) => {
                const res = await fetch(`/api/songs/${song.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ bpm: newBpm }),
                });
                if (res.ok) {
                  setSong((s) => s ? { ...s, bpm: newBpm } : s);
                }
                return res.ok;
              }}
            />
          </div>
        </div>
      </header>

      {/* Top Audio Player */}
      {song.versions.length > 0 ? (
        <AudioPlayer
          version={playerVersion}
          onEnded={() => {}}
        />
      ) : (
        <div className="rounded-lg glass px-4 py-6 text-center mb-6">
          <p className="text-muted text-sm mb-1">No recordings yet</p>
          <p className="text-muted-dim text-xs">
            Upload your first recording from the Versions tab
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border mb-4">
        <button
          onClick={() => setActiveTab("versions")}
          className={`flex-1 py-2.5 text-sm font-medium text-center transition ${
            activeTab === "versions"
              ? "text-foreground border-b-2 border-accent"
              : "text-muted-dim hover:text-foreground/80"
          }`}
        >
          Versions{song.versions.length > 0 ? ` (${song.versions.length})` : ""}
        </button>
        <button
          onClick={() => setActiveTab("lyrics")}
          className={`flex-1 py-2.5 text-sm font-medium text-center transition ${
            activeTab === "lyrics"
              ? "text-foreground border-b-2 border-accent"
              : "text-muted-dim hover:text-foreground/80"
          }`}
        >
          Lyrics
          {song.lyric_sections.length > 0 && (
            <span className="ml-1.5 text-xs text-muted">
              ({song.lyric_sections.length})
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "versions" ? (
        <VersionsSection
          songId={song.id}
          versions={song.versions}
          playerVersionId={playerVersionId}
          onPlayVersion={(id) => setPlayerVersionId(id)}
          onUpdate={fetchSong}
        />
      ) : (
        <LyricsComposer
          songId={song.id}
          initialSections={song.lyric_sections}
          onUpdate={fetchSong}
        />
      )}
    </main>
  );
}
