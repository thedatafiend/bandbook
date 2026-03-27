"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";

interface VersionDetail {
  id: string;
  version_number: number;
  label: string | null;
  audio_url: string;
  audio_duration: number | null;
  notes: string | null;
  is_current: boolean;
  created_at: string;
  created_by_member_id: string;
  created_by_nickname: string;
}

interface SongDetail {
  id: string;
  title: string;
  status: string;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
  versions: VersionDetail[];
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  "in-progress": "In Progress",
  finished: "Finished",
};

export default function SongDetailPage() {
  const router = useRouter();
  const params = useParams();
  const songId = params.id as string;
  const [song, setSong] = useState<SongDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSong = useCallback(async () => {
    const res = await fetch(`/api/songs/${songId}`);
    const data = await res.json();
    setSong(data.song ?? null);
    setLoading(false);
  }, [songId]);

  useEffect(() => {
    fetchSong();
  }, [fetchSong]);

  if (loading) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center">
        <p className="text-zinc-400">Loading...</p>
      </main>
    );
  }

  if (!song) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center">
        <p className="text-zinc-400 mb-4">Song not found</p>
        <button
          onClick={() => router.push("/songs")}
          className="text-white hover:underline"
        >
          Back to catalog
        </button>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-lg mx-auto w-full">
      <header className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.push("/songs")}
          className="text-zinc-400 hover:text-white transition"
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
        <div>
          <h1 className="text-2xl font-bold">{song.title}</h1>
          <p className="text-zinc-500 text-sm">
            {STATUS_LABELS[song.status] ?? song.status}
          </p>
        </div>
      </header>

      <VersionsSection
        songId={song.id}
        versions={song.versions}
        onUpdate={fetchSong}
      />

      {/* Lyrics section placeholder */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Lyrics</h2>
        <div className="rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-6 text-center">
          <p className="text-zinc-400 text-sm">Lyrics composer coming soon</p>
        </div>
      </section>
    </main>
  );
}

function VersionsSection({
  songId,
  versions,
  onUpdate,
}: {
  songId: string;
  versions: VersionDetail[];
  onUpdate: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">
          Versions ({versions.length})
        </h2>
        <button
          onClick={() => setShowUpload(true)}
          className="text-sm text-zinc-300 border border-zinc-600 rounded-lg px-3 py-1.5 hover:bg-zinc-800 transition"
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
        <div className="rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-6 text-center">
          <p className="text-zinc-400 text-sm mb-3">No recordings yet</p>
          <button
            onClick={() => setShowUpload(true)}
            className="text-sm text-white underline hover:no-underline"
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
              isEditing={editingId === v.id}
              onEdit={() => setEditingId(editingId === v.id ? null : v.id)}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function VersionCard({
  version,
  isEditing,
  onEdit,
  onUpdate,
}: {
  version: VersionDetail;
  isEditing: boolean;
  onEdit: () => void;
  onUpdate: () => void;
}) {
  const [label, setLabel] = useState(version.label ?? "");
  const [notes, setNotes] = useState(version.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [settingCurrent, setSettingCurrent] = useState(false);

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

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
          ? "bg-zinc-800 border-white/20"
          : "bg-zinc-800/50 border-zinc-700"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <span className="text-white text-sm font-medium">
            Version {version.version_number}
          </span>
          {version.label && (
            <span className="text-zinc-400 text-sm ml-2">
              — {version.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {version.is_current && (
            <span className="text-xs bg-white/10 text-white px-2 py-0.5 rounded-full">
              Current
            </span>
          )}
          <button
            onClick={onEdit}
            className="text-zinc-500 hover:text-white transition p-1"
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

      <div className="flex items-center gap-3 text-zinc-500 text-xs mt-1">
        <span>by {version.created_by_nickname}</span>
        <span>{formatDate(version.created_at)}</span>
      </div>

      {version.notes && !isEditing && (
        <p className="text-zinc-400 text-xs mt-2 italic">{version.notes}</p>
      )}

      {isEditing && (
        <div className="mt-3 pt-3 border-t border-zinc-700 flex flex-col gap-2">
          <input
            type="text"
            placeholder="Label (e.g. 'Slower tempo take')"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/30"
          />
          <textarea
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/30 resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={saveChanges}
              disabled={saving}
              className="rounded-lg bg-white text-black font-semibold py-1.5 px-3 text-xs hover:bg-zinc-200 transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            {!version.is_current && (
              <button
                onClick={setAsCurrent}
                disabled={settingCurrent}
                className="rounded-lg border border-zinc-600 text-zinc-300 py-1.5 px-3 text-xs hover:bg-zinc-700 transition disabled:opacity-50"
              >
                {settingCurrent ? "Setting..." : "Set as Current"}
              </button>
            )}
            <button
              onClick={onEdit}
              className="text-zinc-500 text-xs hover:text-white transition ml-auto"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
    <div className="rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-4 mb-3">
      {!uploading ? (
        <>
          {!file ? (
            <div className="flex flex-col gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".m4a,.mp3,.wav,.aac,.ogg,audio/*"
                onChange={handleFileSelect}
                className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-zinc-700 file:text-white hover:file:bg-zinc-600"
              />
              <p className="text-zinc-500 text-xs">
                .m4a, .mp3, .wav, .aac, .ogg — Max 500 MB
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {file.name}
                  </p>
                  <p className="text-zinc-500 text-xs">
                    {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="text-zinc-500 text-xs hover:text-white transition shrink-0"
                >
                  Change
                </button>
              </div>
              <button
                onClick={startUpload}
                className="w-full rounded-lg bg-white text-black font-semibold py-2.5 px-4 text-sm hover:bg-zinc-200 transition"
              >
                Upload
              </button>
            </div>
          )}
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          <button
            onClick={onCancel}
            className="text-zinc-500 text-xs hover:text-white transition mt-3"
          >
            Cancel
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="w-full bg-zinc-900 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-white h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-zinc-400 text-xs text-center">
            {progress}% — {file?.name}
          </p>
        </div>
      )}
    </div>
  );
}
