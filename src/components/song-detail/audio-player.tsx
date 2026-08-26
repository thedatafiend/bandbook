"use client";

import { useState, useRef } from "react";
import { formatTime, type VersionDetail } from "./shared";

export function AudioPlayer({
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

  // Reset when version changes — state adjustment during render (the
  // React-recommended pattern) instead of a cascading effect.
  const [prevVersionId, setPrevVersionId] = useState(version?.id);
  if (version?.id !== prevVersionId) {
    setPrevVersionId(version?.id);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }

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
