"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { SongDetailSkeleton } from "@/components/skeletons/song-detail-skeleton";

interface VersionDetail {
  id: string;
  version_number: number;
  label: string | null;
  audio_url: string;
  signed_audio_url: string | null;
  audio_duration: number | null;
  notes: string | null;
  is_current: boolean;
  created_at: string;
  created_by_member_id: string;
  created_by_nickname: string;
}

interface LyricSectionDetail {
  id: string;
  section_type: string;
  section_label: string | null;
  content: string;
  sort_order: number;
  updated_at: string;
  updated_by_nickname: string | null;
}

interface SongDetail {
  id: string;
  title: string;
  status: string;
  bpm: number | null;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
  versions: VersionDetail[];
  lyric_sections: LyricSectionDetail[];
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  "in-progress": "In Progress",
  finished: "Finished",
};

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "in-progress", label: "In Progress" },
  { value: "finished", label: "Finished" },
];

const SECTION_TYPE_COLORS: Record<string, string> = {
  verse: "bg-blue-500/20 text-blue-300",
  chorus: "bg-fuchsia-500/20 text-fuchsia-300",
  "pre-chorus": "bg-indigo-500/20 text-indigo-300",
  bridge: "bg-amber-500/20 text-amber-300",
  intro: "bg-teal-500/20 text-teal-300",
  outro: "bg-rose-500/20 text-rose-300",
  custom: "bg-surface-alt/60 text-muted",
};

export default function SongDetailPage() {
  const router = useRouter();
  const params = useParams();
  const songId = params.id as string;
  const [song, setSong] = useState<SongDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [activeTab, setActiveTab] = useState<"versions" | "lyrics">("versions");
  const [playerVersionId, setPlayerVersionId] = useState<string | null>(null);

  const fetchSong = useCallback(async () => {
    // Fetch auth and song data in parallel
    const [authRes, res] = await Promise.all([
      fetch("/api/auth/me"),
      fetch(`/api/songs/${songId}`),
    ]);

    if (authRes.status === 401 || !(await authRes.json()).member) {
      setSessionExpired(true);
      setLoading(false);
      return;
    }

    setSessionExpired(false);
    const data = await res.json();
    const s = data.song as SongDetail | null;
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
  }, [songId]);

  useEffect(() => {
    fetchSong();
  }, [fetchSong]);

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

/* ─── Editable Title ─── */

function EditableTitle({
  value,
  onSave,
}: {
  value: string;
  onSave: (newValue: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function handleSave() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === value) {
      setDraft(value);
      setEditing(false);
      return;
    }
    setSaving(true);
    const ok = await onSave(trimmed);
    setSaving(false);
    if (ok) {
      setEditing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      setDraft(value);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          disabled={saving}
          className="text-2xl font-bold bg-surface-alt border border-border rounded-lg px-2 py-0.5 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 w-full min-w-0"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => { setDraft(value); setEditing(true); }}
      className="group flex items-center gap-1.5 text-left"
      title="Click to edit"
    >
      <h1 className="text-2xl font-bold truncate">{value}</h1>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-muted-dim opacity-0 group-hover:opacity-100 transition"
      >
        <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      </svg>
    </button>
  );
}

/* ─── Editable Status ─── */

function EditableStatus({
  value,
  onSave,
}: {
  value: string;
  onSave: (newValue: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleSelect(next: string) {
    if (next === value) {
      setOpen(false);
      return;
    }
    setSaving(true);
    const ok = await onSave(next);
    setSaving(false);
    if (ok) setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={saving}
        className="group inline-flex items-center gap-1 hover:text-foreground/80 transition disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Click to change status"
      >
        <span>{STATUS_LABELS[value] ?? value}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 opacity-60 group-hover:opacity-100 transition"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full mt-1 z-10 glass rounded-lg shadow-lg py-1 min-w-[140px]"
        >
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => handleSelect(opt.value)}
              disabled={saving}
              className={`w-full text-left px-3 py-1.5 text-sm transition hover:bg-white/[0.06] ${
                opt.value === value
                  ? "text-foreground"
                  : "text-foreground/80"
              }`}
            >
              {opt.label}
              {opt.value === value && (
                <span className="ml-2 text-accent" aria-hidden="true">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Editable BPM ─── */

function EditableBpm({
  value,
  onSave,
}: {
  value: number | null;
  onSave: (newValue: number | null) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function handleSave() {
    const trimmed = draft.trim();
    let nextValue: number | null;
    if (trimmed === "") {
      nextValue = null;
    } else {
      const parsed = Number(trimmed);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 999) {
        setError("1–999");
        return;
      }
      nextValue = parsed;
    }
    if (nextValue === value) {
      setEditing(false);
      setError(null);
      return;
    }
    setSaving(true);
    const ok = await onSave(nextValue);
    setSaving(false);
    if (ok) {
      setEditing(false);
      setError(null);
    } else {
      setError("Failed");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      setDraft(value != null ? String(value) : "");
      setError(null);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          min={1}
          max={999}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          disabled={saving}
          placeholder="BPM"
          aria-label="BPM"
          className="w-16 bg-surface-alt border border-border rounded px-1.5 py-0.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <span className="text-muted-dim text-xs">BPM</span>
        {error && <span className="text-red-400 text-xs">{error}</span>}
      </span>
    );
  }

  return (
    <button
      onClick={() => {
        setDraft(value != null ? String(value) : "");
        setEditing(true);
      }}
      className="group inline-flex items-center gap-1 hover:text-foreground/80 transition"
      title="Click to edit tempo"
    >
      <span>{value != null ? `${value} BPM` : "Set BPM"}</span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 opacity-0 group-hover:opacity-100 transition"
      >
        <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      </svg>
    </button>
  );
}

/* ─── Audio Player ─── */

function AudioPlayer({
  version,
  onEnded,
}: {
  version: VersionDetail | null;
  onEnded: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);

  // Reset when version changes
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [version?.id]);

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  }

  function handleTimeUpdate() {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  }

  function handleLoadedMetadata() {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
  }

  function handleEnded() {
    setPlaying(false);
    setCurrentTime(0);
    onEnded();
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    if (!audioRef.current || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = ratio * duration;
    setCurrentTime(audioRef.current.currentTime);
  }

  if (!version || !version.signed_audio_url) {
    return (
      <div className="rounded-lg glass px-4 py-5 text-center mb-6">
        <p className="text-muted-dim text-sm">Audio unavailable</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg glass px-4 py-4 mb-6">
      <audio
        ref={audioRef}
        src={version.signed_audio_url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        preload="metadata"
      />

      <div className="flex items-center gap-3">
        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-accent text-foreground hover:bg-accent-hover transition"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          {/* Version info */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-foreground text-sm font-medium truncate">
              Version {version.version_number}
            </span>
            {version.label && (
              <span className="text-muted text-xs truncate">
                — {version.label}
              </span>
            )}
            {version.is_current && (
              <span className="text-xs bg-accent/20 text-foreground px-1.5 py-0.5 rounded-full shrink-0">
                Current
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div
            ref={progressRef}
            className="w-full h-1.5 bg-border rounded-full cursor-pointer"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-accent rounded-full transition-[width] duration-100"
              style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%" }}
            />
          </div>

          {/* Time */}
          <div className="flex justify-between mt-1">
            <span className="text-muted-dim text-xs">{formatTime(currentTime)}</span>
            <span className="text-muted-dim text-xs">{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Versions Section ─── */

function VersionsSection({
  songId,
  versions,
  playerVersionId,
  onPlayVersion,
  onUpdate,
}: {
  songId: string;
  versions: VersionDetail[];
  playerVersionId: string | null;
  onPlayVersion: (id: string) => void;
  onUpdate: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="sr-only">Versions</h2>
        <button
          onClick={() => setShowUpload(true)}
          className="ml-auto text-sm text-foreground/80 border border-border-light rounded-lg px-3 py-1.5 hover:bg-surface transition"
        >
          + Add Recording
        </button>
      </div>

      {showUpload && (
        <UploadWidget
          songId={songId}
          onDone={() => {
            setShowUpload(false);
            onUpdate();
          }}
          onCancel={() => setShowUpload(false)}
        />
      )}

      {versions.length === 0 && !showUpload && (
        <div className="rounded-lg glass px-4 py-6 text-center">
          <p className="text-muted text-sm mb-3">No recordings yet</p>
          <button
            onClick={() => setShowUpload(true)}
            className="text-sm text-foreground underline hover:no-underline"
          >
            Upload your first recording
          </button>
        </div>
      )}

      {versions.length > 0 && (
        <div className="flex flex-col gap-2">
          {versions.map((v) => (
            <VersionCard
              key={v.id}
              version={v}
              isPlaying={playerVersionId === v.id}
              isEditing={editingId === v.id}
              onPlay={() => onPlayVersion(v.id)}
              onEdit={() => setEditingId(editingId === v.id ? null : v.id)}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ─── Version Card ─── */

function VersionCard({
  version,
  isPlaying,
  isEditing,
  onPlay,
  onEdit,
  onUpdate,
}: {
  version: VersionDetail;
  isPlaying: boolean;
  isEditing: boolean;
  onPlay: () => void;
  onEdit: () => void;
  onUpdate: () => void;
}) {
  const [label, setLabel] = useState(version.label ?? "");
  const [notes, setNotes] = useState(version.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [settingCurrent, setSettingCurrent] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function saveChanges() {
    setSaving(true);
    await fetch(`/api/versions/${version.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, notes }),
    });
    setSaving(false);
    onEdit();
    onUpdate();
  }

  async function setAsCurrent() {
    setSettingCurrent(true);
    await fetch(`/api/versions/${version.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setCurrent: true }),
    });
    setSettingCurrent(false);
    onUpdate();
  }

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        version.is_current
          ? "glass border-accent/20"
          : "glass"
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Play button */}
        <button
          onClick={onPlay}
          className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full border transition ${
            isPlaying
              ? "bg-accent text-foreground border-accent"
              : "bg-transparent text-muted border-border-light hover:text-foreground hover:border-accent/50"
          }`}
          aria-label={`Play version ${version.version_number}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <span className="text-foreground text-sm font-medium">
            Version {version.version_number}
          </span>
          {version.label && (
            <p className="text-muted text-sm truncate">
              {version.label}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-muted-dim text-xs mt-0.5">
            <span>by {version.created_by_nickname}</span>
            <span>{formatDate(version.created_at)}</span>
            {version.audio_duration != null && (
              <span>{formatTime(version.audio_duration)}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {version.is_current && (
            <span className="text-xs bg-accent/20 text-foreground px-2 py-0.5 rounded-full">
              Current
            </span>
          )}
          <button
            onClick={onEdit}
            className="text-muted-dim hover:text-foreground transition p-1"
            aria-label="Edit version"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
          </button>
        </div>
      </div>

      {version.notes && !isEditing && (
        <p className="text-muted text-xs mt-2 italic ml-11">{version.notes}</p>
      )}

      {isEditing && (
        <div className="mt-3 pt-3 border-t border-border flex flex-col gap-2">
          <input
            type="text"
            placeholder="Label (e.g. 'Slower tempo take')"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="rounded-lg bg-surface-alt border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-dim focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <textarea
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="rounded-lg bg-surface-alt border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-dim focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={saveChanges}
              disabled={saving}
              className="rounded-lg bg-accent text-foreground font-semibold py-1.5 px-3 text-xs hover:bg-accent-hover transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            {!version.is_current && (
              <button
                onClick={setAsCurrent}
                disabled={settingCurrent}
                className="rounded-lg border border-border-light text-foreground/80 py-1.5 px-3 text-xs hover:bg-surface-alt transition disabled:opacity-50"
              >
                {settingCurrent ? "Setting..." : "Set as Current"}
              </button>
            )}
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg border border-red-500/30 text-red-400 py-1.5 px-3 text-xs hover:bg-red-500/10 transition"
              >
                Delete
              </button>
            ) : (
              <button
                onClick={async () => {
                  setDeleting(true);
                  await fetch(`/api/versions/${version.id}`, {
                    method: "DELETE",
                  });
                  setDeleting(false);
                  setConfirmDelete(false);
                  onEdit();
                  onUpdate();
                }}
                disabled={deleting}
                className="rounded-lg bg-red-600 text-white py-1.5 px-3 text-xs hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Confirm Delete"}
              </button>
            )}
            <button
              onClick={() => { setConfirmDelete(false); onEdit(); }}
              className="text-muted-dim text-xs hover:text-foreground transition ml-auto"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Lyrics Composer ─── */

interface EditableSection {
  clientId: string;
  id?: string;
  section_type: string;
  section_label: string | null;
  content: string;
  sort_order: number;
}

interface RevisionItem {
  id: string;
  snapshot: { sections: Array<{ section_type: string; section_label: string | null; content: string; sort_order: number }> };
  created_at: string;
  created_by_nickname: string;
  revision_note: string | null;
}

const SECTION_TYPES: Array<{ value: string; label: string }> = [
  { value: "verse", label: "Verse" },
  { value: "chorus", label: "Chorus" },
  { value: "pre-chorus", label: "Pre-Chorus" },
  { value: "bridge", label: "Bridge" },
  { value: "intro", label: "Intro" },
  { value: "outro", label: "Outro" },
  { value: "custom", label: "Custom" },
];

let clientIdCounter = 0;
function newClientId() {
  return `c_${++clientIdCounter}_${Date.now()}`;
}

function LyricsComposer({
  songId,
  initialSections,
  onUpdate,
}: {
  songId: string;
  initialSections: LyricSectionDetail[];
  onUpdate: () => void;
}) {
  const [sections, setSections] = useState<EditableSection[]>(() =>
    initialSections.map((s) => ({
      clientId: newClientId(),
      id: s.id,
      section_type: s.section_type,
      section_label: s.section_label,
      content: s.content,
      sort_order: s.sort_order,
    }))
  );
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [readMode, setReadMode] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [typeChangeId, setTypeChangeId] = useState<string | null>(null);
  const [staleBanner, setStaleBanner] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRevisionIdRef = useRef<string | null>(null);
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  // Drag state — pointer-event based for mobile+desktop
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragNodeRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save with debounce
  const triggerSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      performSave(sectionsRef.current);
    }, 2000);
  }, [songId]);

  async function performSave(secs: EditableSection[]) {
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/songs/${songId}/lyrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: secs.map((s, i) => ({
            section_type: s.section_type,
            section_label: s.section_label,
            content: s.content,
            sort_order: i,
          })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        // Check for stale data
        if (
          latestRevisionIdRef.current &&
          data.revision_id &&
          latestRevisionIdRef.current !== data.revision_id
        ) {
          // We just saved, so update our ref
        }
        latestRevisionIdRef.current = data.revision_id;
        // Update section IDs from server (matched by array position)
        if (data.sections) {
          const serverSections = data.sections as Array<{ id: string; sort_order: number }>;
          setSections((prev) =>
            prev.map((s, i) => ({
              ...s,
              id: serverSections[i]?.id ?? s.id,
              sort_order: i,
            }))
          );
        }
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      }
    } catch {
      setSaveStatus("idle");
    }
  }

  function updateSection(clientId: string, changes: Partial<EditableSection>) {
    setSections((prev) =>
      prev.map((s) => (s.clientId === clientId ? { ...s, ...changes } : s))
    );
    triggerSave();
  }

  function addSection(type: string, label?: string) {
    const newSection: EditableSection = {
      clientId: newClientId(),
      section_type: type,
      section_label: type === "custom" ? (label || "Custom") : null,
      content: "",
      sort_order: sections.length,
    };
    setSections((prev) => [...prev, newSection]);
    setShowTypePicker(false);
    // Don't auto-save empty section — user will type and that triggers save
  }

  function deleteSection(clientId: string) {
    setSections((prev) => prev.filter((s) => s.clientId !== clientId));
    setMenuOpenId(null);
    triggerSave();
  }

  function duplicateSection(clientId: string) {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.clientId === clientId);
      if (idx === -1) return prev;
      const source = prev[idx];
      const copy: EditableSection = {
        ...source,
        clientId: newClientId(),
        id: undefined,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    setMenuOpenId(null);
    triggerSave();
  }

  function moveSection(fromIdx: number, toIdx: number) {
    setSections((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next.map((s, i) => ({ ...s, sort_order: i }));
    });
    triggerSave();
  }

  function changeSectionType(clientId: string, newType: string, label?: string) {
    updateSection(clientId, {
      section_type: newType,
      section_label: newType === "custom" ? (label || "Custom") : null,
    });
    setTypeChangeId(null);
    setMenuOpenId(null);
  }

  // Drag handlers — pointer events for touch + mouse
  // We track pointer position globally and hit-test card rects
  function handlePointerDownOnHandle(e: React.PointerEvent, idx: number) {
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);

    const isTouchDevice = e.pointerType === "touch";
    if (isTouchDevice) {
      longPressTimer.current = setTimeout(() => {
        setDragIdx(idx);
      }, 300);
    } else {
      setDragIdx(idx);
    }
  }

  function handlePointerMoveOnHandle(e: React.PointerEvent) {
    if (dragIdx === null) return;
    // Hit-test which card the pointer is over
    const y = e.clientY;
    let overIdx: number | null = null;
    dragNodeRefs.current.forEach((el, idx) => {
      const rect = el.getBoundingClientRect();
      if (y >= rect.top && y <= rect.bottom) {
        overIdx = idx;
      }
    });
    if (overIdx !== null && overIdx !== dragIdx) {
      setDragOverIdx(overIdx);
    }
  }

  function handlePointerUpOnHandle() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
      const fromIdx = dragIdx;
      const toIdx = dragOverIdx;
      setSections((prev) => {
        const next = [...prev];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        return next.map((s, i) => ({ ...s, sort_order: i }));
      });
      triggerSave();
    }
    setDragIdx(null);
    setDragOverIdx(null);
  }

  function handlePointerCancelOnHandle() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setDragIdx(null);
    setDragOverIdx(null);
  }

  // Stale data check
  useEffect(() => {
    if (!showHistory) {
      // Periodically check for stale data (every 30s)
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/songs/${songId}/lyrics/revisions`);
          const data = await res.json();
          const revisions = data.revisions as RevisionItem[];
          if (revisions && revisions.length > 0) {
            const latest = revisions[0];
            if (
              latestRevisionIdRef.current &&
              latest.id !== latestRevisionIdRef.current
            ) {
              setStaleBanner(
                `Lyrics were updated by ${latest.created_by_nickname}`
              );
            }
          }
        } catch {
          // ignore
        }
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [songId, showHistory]);

  // Initialize revision ID
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/songs/${songId}/lyrics/revisions`);
        const data = await res.json();
        const revisions = data.revisions as RevisionItem[];
        if (revisions && revisions.length > 0) {
          latestRevisionIdRef.current = revisions[0].id;
        }
      } catch {
        // ignore
      }
    })();
  }, [songId]);

  // Read Mode
  if (readMode) {
    return (
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-muted">Read Mode</h2>
          <button
            onClick={() => setReadMode(false)}
            className="text-sm text-foreground/80 border border-border-light rounded-lg px-3 py-1.5 hover:bg-surface transition"
          >
            Edit
          </button>
        </div>
        {sections.length === 0 ? (
          <p className="text-muted-dim text-center py-8">No lyrics yet</p>
        ) : (
          <div className="flex flex-col gap-5">
            {sections.map((section) => (
              <div key={section.clientId}>
                <span
                  className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-2 ${
                    SECTION_TYPE_COLORS[section.section_type] ?? SECTION_TYPE_COLORS.custom
                  }`}
                >
                  {section.section_label ?? section.section_type.charAt(0).toUpperCase() + section.section_type.slice(1)}
                </span>
                <p className="text-foreground text-xl whitespace-pre-wrap leading-relaxed font-light">
                  {section.content || "\u00A0"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  // Revision History modal
  if (showHistory) {
    return (
      <RevisionHistory
        songId={songId}
        onClose={() => setShowHistory(false)}
        onRestore={(restoredSections, revisionId) => {
          setSections(
            restoredSections.map((s, i) => ({
              clientId: newClientId(),
              section_type: s.section_type,
              section_label: s.section_label,
              content: s.content,
              sort_order: i,
            }))
          );
          latestRevisionIdRef.current = revisionId;
          setStaleBanner(null);
          setShowHistory(false);
          onUpdate();
        }}
      />
    );
  }

  return (
    <section>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-dim">
            {saveStatus === "saving"
              ? "Saving..."
              : saveStatus === "saved"
              ? "Saved"
              : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(true)}
            className="text-xs text-muted hover:text-foreground transition px-2 py-1"
            aria-label="Revision history"
          >
            History
          </button>
          <button
            onClick={() => setReadMode(true)}
            className="text-sm text-foreground/80 border border-border-light rounded-lg px-3 py-1.5 hover:bg-surface transition"
          >
            Read
          </button>
        </div>
      </div>

      {/* Stale data banner */}
      {staleBanner && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 mb-3 flex items-center justify-between">
          <p className="text-amber-300 text-xs">{staleBanner}. Your next save will overwrite.</p>
          <button
            onClick={() => setStaleBanner(null)}
            className="text-amber-300/60 hover:text-amber-300 transition text-xs ml-2 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Sections */}
      {sections.length === 0 ? (
        <div className="rounded-lg glass px-4 py-8 text-center mb-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto mb-3 text-muted-dim"
          >
            <path d="M12 20h9" />
            <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
          </svg>
          <p className="text-muted text-sm mb-1">No lyrics yet</p>
          <p className="text-muted-dim text-xs">
            Add a section below to start writing
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-3">
          {sections.map((section, idx) => (
            <div
              key={section.clientId}
              ref={(el) => {
                if (el) dragNodeRefs.current.set(idx, el);
                else dragNodeRefs.current.delete(idx);
              }}
              className={`rounded-lg border px-4 py-3 transition-colors ${
                dragOverIdx === idx && dragIdx !== idx
                  ? "border-accent/40 bg-white/[0.08]"
                  : dragIdx === idx
                  ? "border-accent/30 bg-white/[0.04]"
                  : "glass"
              } ${dragIdx === idx ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-2 mb-2">
                {/* Drag handle — all pointer events on this element */}
                <span
                  onPointerDown={(e) => handlePointerDownOnHandle(e, idx)}
                  onPointerMove={handlePointerMoveOnHandle}
                  onPointerUp={handlePointerUpOnHandle}
                  onPointerCancel={handlePointerCancelOnHandle}
                  className="cursor-grab active:cursor-grabbing text-muted-dim hover:text-muted transition select-none touch-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="9" cy="6" r="1.5" />
                    <circle cx="15" cy="6" r="1.5" />
                    <circle cx="9" cy="12" r="1.5" />
                    <circle cx="15" cy="12" r="1.5" />
                    <circle cx="9" cy="18" r="1.5" />
                    <circle cx="15" cy="18" r="1.5" />
                  </svg>
                </span>

                {/* Section type badge */}
                {typeChangeId === section.clientId ? (
                  <div className="flex flex-wrap gap-1">
                    {SECTION_TYPES.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => {
                          if (t.value === "custom") {
                            const label = prompt("Custom section label:");
                            if (label) changeSectionType(section.clientId, t.value, label);
                            else setTypeChangeId(null);
                          } else {
                            changeSectionType(section.clientId, t.value);
                          }
                        }}
                        className={`text-xs px-2 py-0.5 rounded-full transition ${
                          SECTION_TYPE_COLORS[t.value] ?? SECTION_TYPE_COLORS.custom
                        } ${section.section_type === t.value ? "ring-1 ring-accent/50" : "opacity-70 hover:opacity-100"}`}
                      >
                        {t.label}
                      </button>
                    ))}
                    <button
                      onClick={() => setTypeChangeId(null)}
                      className="text-muted-dim text-xs hover:text-foreground transition"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <span
                    className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                      SECTION_TYPE_COLORS[section.section_type] ?? SECTION_TYPE_COLORS.custom
                    }`}
                  >
                    {section.section_label ?? section.section_type.charAt(0).toUpperCase() + section.section_type.slice(1)}
                  </span>
                )}

                {/* Menu */}
                <div className="ml-auto relative">
                  <button
                    onClick={() => setMenuOpenId(menuOpenId === section.clientId ? null : section.clientId)}
                    className="text-muted-dim hover:text-foreground transition p-1"
                    aria-label="Section options"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="1" />
                      <circle cx="19" cy="12" r="1" />
                      <circle cx="5" cy="12" r="1" />
                    </svg>
                  </button>
                  {menuOpenId === section.clientId && (
                    <div className="absolute right-0 top-8 z-10 glass rounded-lg shadow-lg py-1 min-w-[140px]">
                      {idx > 0 && (
                        <button
                          onClick={() => {
                            moveSection(idx, idx - 1);
                            setMenuOpenId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-sm text-foreground/80 hover:bg-white/[0.06] transition"
                        >
                          Move Up
                        </button>
                      )}
                      {idx < sections.length - 1 && (
                        <button
                          onClick={() => {
                            moveSection(idx, idx + 1);
                            setMenuOpenId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-sm text-foreground/80 hover:bg-white/[0.06] transition"
                        >
                          Move Down
                        </button>
                      )}
                      <button
                        onClick={() => duplicateSection(section.clientId)}
                        className="w-full text-left px-3 py-1.5 text-sm text-foreground/80 hover:bg-white/[0.06] transition"
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={() => {
                          setTypeChangeId(section.clientId);
                          setMenuOpenId(null);
                        }}
                        className="w-full text-left px-3 py-1.5 text-sm text-foreground/80 hover:bg-white/[0.06] transition"
                      >
                        Change Type
                      </button>
                      <button
                        onClick={() => deleteSection(section.clientId)}
                        className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-white/[0.06] transition"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Content textarea */}
              <textarea
                value={section.content}
                onChange={(e) => updateSection(section.clientId, { content: e.target.value })}
                placeholder="Write lyrics..."
                rows={3}
                className="w-full bg-transparent text-foreground/90 text-sm placeholder:text-muted-dim resize-none focus:outline-none leading-relaxed"
              />
            </div>
          ))}
        </div>
      )}

      {/* Add Section */}
      {showTypePicker ? (
        <div className="rounded-lg glass px-4 py-3">
          <p className="text-muted text-xs mb-2">Choose section type:</p>
          <div className="flex flex-wrap gap-2">
            {SECTION_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => {
                  if (t.value === "custom") {
                    const label = prompt("Custom section label:");
                    if (label) addSection(t.value, label);
                  } else {
                    addSection(t.value);
                  }
                }}
                className={`text-xs px-3 py-1.5 rounded-full transition ${
                  SECTION_TYPE_COLORS[t.value] ?? SECTION_TYPE_COLORS.custom
                } hover:opacity-80`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowTypePicker(false)}
            className="text-muted-dim text-xs hover:text-foreground transition mt-2"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowTypePicker(true)}
          className="w-full rounded-lg border border-dashed border-border-light text-muted py-3 text-sm hover:border-accent/50 hover:text-foreground/80 transition"
        >
          + Add Section
        </button>
      )}
    </section>
  );
}

/* ─── Revision History ─── */

function RevisionHistory({
  songId,
  onClose,
  onRestore,
}: {
  songId: string;
  onClose: () => void;
  onRestore: (
    sections: Array<{ section_type: string; section_label: string | null; content: string; sort_order: number }>,
    revisionId: string
  ) => void;
}) {
  const [revisions, setRevisions] = useState<RevisionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewRevision, setPreviewRevision] = useState<RevisionItem | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/songs/${songId}/lyrics/revisions`);
      const data = await res.json();
      setRevisions(data.revisions ?? []);
      setLoading(false);
    })();
  }, [songId]);

  async function handleRestore(revisionId: string) {
    setRestoring(true);
    const res = await fetch(`/api/songs/${songId}/lyrics/revisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revisionId }),
    });
    const data = await res.json();
    if (res.ok && data.sections) {
      onRestore(
        (data.sections as Array<{ section_type: string; section_label: string | null; content: string; sort_order: number }>),
        data.revision_id
      );
    }
    setRestoring(false);
  }

  // Preview mode
  if (previewRevision) {
    const snap = previewRevision.snapshot;
    return (
      <section>
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setPreviewRevision(null)}
            className="text-muted hover:text-foreground transition text-sm"
          >
            &larr; Back to history
          </button>
          <button
            onClick={() => handleRestore(previewRevision.id)}
            disabled={restoring}
            className="rounded-lg bg-accent text-foreground font-semibold py-1.5 px-3 text-xs hover:bg-accent-hover transition disabled:opacity-50"
          >
            {restoring ? "Restoring..." : "Restore this version"}
          </button>
        </div>
        <p className="text-muted-dim text-xs mb-3">
          {formatDateTime(previewRevision.created_at)} by {previewRevision.created_by_nickname}
          {previewRevision.revision_note && (
            <span className="italic ml-1">— {previewRevision.revision_note}</span>
          )}
        </p>
        <div className="flex flex-col gap-3">
          {(snap.sections ?? []).map((s, i) => (
            <div key={i} className="rounded-lg glass px-4 py-3">
              <span
                className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-2 ${
                  SECTION_TYPE_COLORS[s.section_type] ?? SECTION_TYPE_COLORS.custom
                }`}
              >
                {s.section_label ?? s.section_type.charAt(0).toUpperCase() + s.section_type.slice(1)}
              </span>
              <p className="text-foreground/90 text-sm whitespace-pre-wrap leading-relaxed">
                {s.content || "\u00A0"}
              </p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-muted">Revision History</h2>
        <button
          onClick={onClose}
          className="text-sm text-foreground/80 border border-border-light rounded-lg px-3 py-1.5 hover:bg-surface transition"
        >
          Back to Editor
        </button>
      </div>

      {loading ? (
        <p className="text-muted-dim text-sm text-center py-8">Loading...</p>
      ) : revisions.length === 0 ? (
        <div className="rounded-lg glass px-4 py-8 text-center">
          <p className="text-muted text-sm">No revisions yet</p>
          <p className="text-muted-dim text-xs mt-1">
            Revisions are created automatically when you save lyrics
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {revisions.map((rev, idx) => (
            <button
              key={rev.id}
              onClick={() => setPreviewRevision(rev)}
              className="w-full text-left rounded-lg glass glass-hover px-4 py-3 transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-foreground text-sm">
                    {idx === 0 ? "Latest" : formatDateTime(rev.created_at)}
                  </p>
                  <p className="text-muted-dim text-xs mt-0.5">
                    by {rev.created_by_nickname}
                    {rev.revision_note && <span className="italic"> — {rev.revision_note}</span>}
                  </p>
                </div>
                <span className="text-muted-dim text-xs">
                  {rev.snapshot.sections?.length ?? 0} sections
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/* ─── Upload Widget ─── */

function UploadWidget({
  songId,
  onDone,
  onCancel,
}: {
  songId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const MAX_SIZE = 500 * 1024 * 1024;
    if (selected.size > MAX_SIZE) {
      setError("File too large (max 500 MB)");
      return;
    }
    setFile(selected);
    setError("");
  }

  function startUpload() {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/songs/${songId}/versions`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onDone();
      } else {
        let msg = "Upload failed";
        try {
          msg = JSON.parse(xhr.responseText).error ?? msg;
        } catch {
          // ignore
        }
        setError(msg);
        setUploading(false);
      }
    };

    xhr.onerror = () => {
      setError("Upload failed. Check your connection.");
      setUploading(false);
    };

    xhr.send(formData);
  }

  return (
    <div className="rounded-lg glass px-4 py-4 mb-3">
      {!uploading ? (
        <>
          {!file ? (
            <div className="flex flex-col gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".m4a,.mp3,.wav,.aac,.ogg,audio/*"
                onChange={handleFileSelect}
                className="block w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-border file:text-foreground hover:file:bg-border-light"
              />
              <p className="text-muted-dim text-xs">
                .m4a, .mp3, .wav, .aac, .ogg — Max 500 MB
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-foreground text-sm font-medium truncate">
                    {file.name}
                  </p>
                  <p className="text-muted-dim text-xs">
                    {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="text-muted-dim text-xs hover:text-foreground transition shrink-0"
                >
                  Change
                </button>
              </div>
              <button
                onClick={startUpload}
                className="w-full rounded-lg bg-accent text-foreground font-semibold py-2.5 px-4 text-sm hover:bg-accent-hover transition"
              >
                Upload
              </button>
            </div>
          )}
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          <button
            onClick={onCancel}
            className="text-muted-dim text-xs hover:text-foreground transition mt-3"
          >
            Cancel
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="w-full bg-surface-alt rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-accent h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-muted text-xs text-center">
            {progress}% — {file?.name}
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ─── */

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
