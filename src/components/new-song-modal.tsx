"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

type Step =
  | "choose"
  | "lyrics-title"
  | "upload-file"
  | "upload-destination"
  | "uploading";

interface SongSummary {
  id: string;
  title: string;
  version_count: number;
}

export function NewSongModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("choose");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [songs, setSongs] = useState<SongSummary[]>([]);
  const [songSearch, setSongSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch existing songs for "Add to Existing" flow
  const fetchSongs = useCallback(async () => {
    const res = await fetch("/api/songs");
    if (res.ok) {
      const data = await res.json();
      setSongs(data.songs ?? []);
    }
  }, []);

  useEffect(() => {
    if (step === "upload-destination") {
      fetchSongs();
    }
  }, [step, fetchSongs]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function createSongOnly() {
    if (!title.trim()) {
      setError("Song title is required");
      return;
    }
    setError("");
    setLoading(true);

    const res = await fetch("/api/songs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }

    router.push(`/songs/${data.song.id}`);
  }

  async function createSongAndUpload() {
    if (!title.trim()) {
      setError("Song title is required");
      return;
    }
    if (!file) return;

    setError("");
    setLoading(true);

    // Create song first
    const res = await fetch("/api/songs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    });

    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      setError(data.error ?? "Failed to create song");
      return;
    }

    // Upload to the new song
    setLoading(false);
    uploadToSong(data.song.id);
  }

  function uploadToSong(songId: string) {
    if (!file) return;
    setStep("uploading");
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/songs/${songId}/versions`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        router.push(`/songs/${songId}`);
      } else {
        let msg = "Upload failed";
        try {
          const resp = JSON.parse(xhr.responseText);
          msg = resp.error ?? msg;
        } catch {
          // ignore parse error
        }
        setError(msg);
        setStep("upload-destination");
      }
    };

    xhr.onerror = () => {
      setError("Upload failed. Check your connection and try again.");
      setStep("upload-destination");
    };

    xhr.send(formData);
  }

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
    setStep("upload-destination");
  }

  const filteredSongs = songs.filter((s) =>
    s.title.toLowerCase().includes(songSearch.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative bg-background border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">
            {step === "choose" && "New Song"}
            {step === "lyrics-title" && "Start with Lyrics"}
            {step === "upload-file" && "Upload a Recording"}
            {step === "upload-destination" && "Where should it go?"}
            {step === "uploading" && "Uploading..."}
          </h2>
          {step !== "uploading" && (
            <button
              onClick={onClose}
              className="text-muted hover:text-foreground transition p-1"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {/* Step: Choose path */}
        {step === "choose" && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setStep("lyrics-title")}
              className="w-full rounded-lg bg-accent text-white font-semibold py-3 px-4 hover:bg-accent-hover transition text-left"
            >
              <div className="font-semibold">Start with Lyrics</div>
              <div className="text-sm text-white/70">
                Create a song with just a title — add audio later
              </div>
            </button>
            <button
              onClick={() => {
                setStep("upload-file");
                setTimeout(() => fileInputRef.current?.click(), 100);
              }}
              className="w-full rounded-lg border border-border-light text-foreground font-semibold py-3 px-4 hover:bg-surface-alt transition text-left"
            >
              <div className="font-semibold">Upload a Recording</div>
              <div className="text-sm text-muted-dim">
                Upload an audio file from your device
              </div>
            </button>
          </div>
        )}

        {/* Step: Lyrics — enter title */}
        {step === "lyrics-title" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createSongOnly();
            }}
            className="flex flex-col gap-4"
          >
            <input
              type="text"
              placeholder="Song title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              required
              className="rounded-lg bg-surface-alt border border-border px-4 py-3 text-foreground placeholder:text-muted-dim focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-accent text-white font-semibold py-3 px-4 hover:bg-accent-hover transition disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Song"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("choose");
                setTitle("");
                setError("");
              }}
              className="text-muted text-sm hover:text-foreground transition"
            >
              Back
            </button>
          </form>
        )}

        {/* Step: Upload — file picker */}
        {step === "upload-file" && (
          <div className="flex flex-col gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".m4a,.mp3,.wav,.aac,.ogg,audio/*"
              onChange={handleFileSelect}
              className="block w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-surface-alt file:text-foreground hover:file:bg-border"
            />
            <p className="text-muted-dim text-xs">
              Accepted formats: .m4a, .mp3, .wav, .aac, .ogg — Max 500 MB
            </p>
            <button
              type="button"
              onClick={() => {
                setStep("choose");
                setFile(null);
                setError("");
              }}
              className="text-muted text-sm hover:text-foreground transition"
            >
              Back
            </button>
          </div>
        )}

        {/* Step: Upload destination — new song or existing */}
        {step === "upload-destination" && file && (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg bg-surface border border-border px-4 py-3">
              <p className="text-sm text-muted">Selected file</p>
              <p className="text-foreground text-sm font-medium truncate">
                {file.name}
              </p>
              <p className="text-muted-dim text-xs">
                {(file.size / (1024 * 1024)).toFixed(1)} MB
              </p>
            </div>

            <div className="border-b border-border pb-4">
              <h3 className="text-sm font-semibold text-muted mb-3">
                Create New Song
              </h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createSongAndUpload();
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  placeholder="Song title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="flex-1 rounded-lg bg-surface-alt border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-dim focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="shrink-0 rounded-lg bg-accent text-white font-semibold py-2.5 px-4 text-sm hover:bg-accent-hover transition disabled:opacity-50"
                >
                  {loading ? "..." : "Create"}
                </button>
              </form>
            </div>

            {songs.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted mb-3">
                  Add to Existing Song
                </h3>
                {songs.length > 5 && (
                  <input
                    type="text"
                    placeholder="Search songs..."
                    value={songSearch}
                    onChange={(e) => setSongSearch(e.target.value)}
                    className="w-full rounded-lg bg-surface-alt border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-dim focus:outline-none focus:ring-2 focus:ring-accent/40 mb-2"
                  />
                )}
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                  {filteredSongs.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => uploadToSong(s.id)}
                      className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-surface-alt transition"
                    >
                      <span className="text-foreground text-sm">{s.title}</span>
                      <span className="text-muted-dim text-xs ml-2">
                        {s.version_count}{" "}
                        {s.version_count === 1 ? "version" : "versions"}
                      </span>
                    </button>
                  ))}
                  {filteredSongs.length === 0 && (
                    <p className="text-muted-dim text-sm px-3 py-2">
                      No songs found
                    </p>
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setStep("upload-file");
                setFile(null);
                setTitle("");
                setError("");
              }}
              className="text-muted text-sm hover:text-foreground transition"
            >
              Back
            </button>
          </div>
        )}

        {/* Step: Uploading — progress bar */}
        {step === "uploading" && (
          <div className="flex flex-col gap-4">
            <div className="w-full bg-surface rounded-full h-3 overflow-hidden">
              <div
                className="bg-accent h-full rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-center text-muted text-sm">
              {uploadProgress}% uploaded
            </p>
            {file && (
              <p className="text-center text-muted-dim text-xs truncate">
                {file.name}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
