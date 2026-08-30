"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
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

export function SongDetailView({ initialSong }: { initialSong: SongDetail }) {
  const router = useRouter();
  const [song, setSong] = useState<SongDetail>(initialSong);
  const [activeTab, setActiveTab] = useState<"versions" | "lyrics">(
    initialSong.versions.length === 0 ? "lyrics" : "versions"
  );
  const [playerVersionId, setPlayerVersionId] = useState<string | null>(
    initialSong.versions.find((v) => v.is_current)?.id ?? null
  );

  // The /songs catalog is server-rendered, and navigating back to it can be
  // served from the client Router Cache — without this, a status/title change
  // made here still shows the old value in the list until a hard reload.
  const refreshList = useCallback(() => {
    router.refresh();
  }, [router]);

  // Re-fetch after mutations (uploads, version edits, lyric restores). The
  // endpoint verifies auth itself — a 401 means the session is gone.
  const fetchSong = useCallback(async () => {
    const res = await fetch(`/api/songs/${song.id}`);

    if (res.status === 401) {
      router.push("/sign-in");
      return;
    }
    if (!res.ok) return;

    const data = await res.json();
    const s = data.song as SongDetail | null;
    if (s) {
      setSong(s);
      // Keep the player on a valid version
      setPlayerVersionId((current) => {
        if (current && s.versions.some((v) => v.id === current)) return current;
        return s.versions.find((v) => v.is_current)?.id ?? null;
      });
      // Version/lyric mutations also change what the catalog shows
      // (version count, lyrics badge, updated date)
      refreshList();
    }
  }, [song.id, router, refreshList]);

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
                setSong((s) => ({ ...s, title: newTitle }));
                refreshList();
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
                  setSong((s) => ({ ...s, status: newStatus }));
                  refreshList();
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
                  setSong((s) => ({ ...s, bpm: newBpm }));
                  refreshList();
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
