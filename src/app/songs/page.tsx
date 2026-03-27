"use client";

import { useEffect, useState, useCallback } from "react";
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
  updated_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-700 text-zinc-300",
  "in-progress": "bg-amber-900/60 text-amber-300",
  finished: "bg-green-900/60 text-green-300",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  "in-progress": "In Progress",
  finished: "Finished",
};

export default function SongsPage() {
  const router = useRouter();
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [band, setBand] = useState<BandInfo | null>(null);
  const [songs, setSongs] = useState<SongCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

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
            <p className="text-zinc-400 text-sm">
              Logged in as {member.nickname}
            </p>
          )}
        </div>
        <button
          onClick={() => router.push("/settings")}
          className="text-zinc-400 hover:text-white transition p-2"
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
          <p className="text-zinc-400 mb-6">No songs yet. Start creating!</p>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-white text-black font-semibold py-3 px-6 hover:bg-zinc-200 transition"
          >
            + New Song
          </button>
        </div>
      )}

      {!loading && songs.length > 0 && (
        <>
          <div className="flex flex-col gap-3 mb-6">
            {songs.map((song) => (
              <button
                key={song.id}
                onClick={() => router.push(`/songs/${song.id}`)}
                className="w-full text-left rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-3 hover:bg-zinc-750 hover:border-zinc-600 transition"
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-white font-medium truncate mr-2">
                    {song.title}
                  </h3>
                  <span
                    className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[song.status] ?? STATUS_COLORS.draft}`}
                  >
                    {STATUS_LABELS[song.status] ?? song.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-zinc-500 text-xs">
                  <span>
                    {song.version_count > 0
                      ? `${song.version_count} ${song.version_count === 1 ? "version" : "versions"}`
                      : "Lyrics only"}
                  </span>
                  <span>Updated {formatDate(song.updated_at)}</span>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="w-full rounded-lg bg-white text-black font-semibold py-3 px-4 hover:bg-zinc-200 transition"
          >
            + New Song
          </button>
        </>
      )}

      {showModal && <NewSongModal onClose={() => setShowModal(false)} />}
    </main>
  );
}
