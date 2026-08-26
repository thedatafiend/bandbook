"use client";

import { useState, useRef } from "react";
import { readError } from "./shared";

export function UploadWidget({
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

  async function startUpload() {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError("");

    try {
      // 1. Ask the server for a signed upload URL. Sending the file through
      //    our API route would hit Vercel's ~4.5MB function payload limit
      //    (FUNCTION_PAYLOAD_TOO_LARGE), which is exactly the bug this
      //    refactor fixes. The file goes browser → Supabase Storage directly.
      const urlRes = await fetch(`/api/songs/${songId}/versions/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      });
      if (!urlRes.ok) {
        throw new Error(await readError(urlRes, "Failed to start upload"));
      }
      const { signedUrl, path } = (await urlRes.json()) as {
        signedUrl: string;
        token: string;
        path: string;
      };

      // 2. PUT directly to Supabase Storage's signed URL. Use XHR so we can
      //    show upload progress (fetch can't observe upload progress yet).
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", signedUrl);
        xhr.setRequestHeader("Content-Type", file.type || "audio/mpeg");
        xhr.setRequestHeader("x-upsert", "false");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            const snippet = xhr.responseText?.slice(0, 200).trim();
            reject(
              new Error(
                `Storage upload failed (HTTP ${xhr.status})${snippet ? `: ${snippet}` : ""}`
              )
            );
          }
        };
        xhr.onerror = () =>
          reject(new Error("Storage upload failed. Check your connection."));
        xhr.send(file);
      });

      // 3. Register the version row. Small JSON body, fits well under the
      //    Vercel function limit.
      const finRes = await fetch(`/api/songs/${songId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (!finRes.ok) {
        throw new Error(await readError(finRes, "Failed to register version"));
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setUploading(false);
    }
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

export default UploadWidget;
