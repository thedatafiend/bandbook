"use client";

import { useState } from "react";

export interface SharePlayerProps {
  token: string;
  title: string;
  versionNumber: number;
  label: string | null;
  durationSeconds: number | null;
  initialAudioUrl: string;
}

function formatTime(seconds: number | null): string | null {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Public, stream-only player for a shared recording. No download control and
 * no link back into the app — a 3rd party sees only this single recording.
 *
 * Signed URLs are short-lived; if playback fails (e.g. the URL expired while
 * the page sat open) we transparently fetch a fresh one from the public API.
 */
export function SharePlayer({
  token,
  title,
  versionNumber,
  label,
  durationSeconds,
  initialAudioUrl,
}: SharePlayerProps) {
  const [audioUrl, setAudioUrl] = useState(initialAudioUrl);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const duration = formatTime(durationSeconds);

  async function refreshUrl() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/share/${token}`);
      if (!res.ok) {
        setError(true);
        return;
      }
      const data = await res.json();
      const fresh = data?.recording?.signedAudioUrl;
      if (typeof fresh === "string" && fresh.length > 0) {
        setError(false);
        setAudioUrl(fresh);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl glass border border-border-light px-6 py-8 text-center">
      <p className="text-muted-dim text-xs uppercase tracking-wide mb-2">
        Shared recording
      </p>
      <h1 className="text-2xl font-semibold text-foreground break-words">
        {title}
      </h1>
      <p className="text-muted text-sm mt-1">
        Version {versionNumber}
        {label ? ` · ${label}` : ""}
        {duration ? ` · ${duration}` : ""}
      </p>

      <div className="mt-6">
        {error ? (
          <div className="text-sm">
            <p className="text-red-400 mb-3">This recording couldn&apos;t be loaded.</p>
            <button
              onClick={refreshUrl}
              disabled={refreshing}
              className="rounded-lg border border-border-light text-foreground/80 py-1.5 px-3 text-xs hover:bg-surface-alt transition disabled:opacity-50"
            >
              {refreshing ? "Retrying..." : "Try again"}
            </button>
          </div>
        ) : (
          <audio
            src={audioUrl}
            controls
            controlsList="nodownload"
            onError={refreshUrl}
            className="w-full"
          />
        )}
      </div>
    </div>
  );
}
