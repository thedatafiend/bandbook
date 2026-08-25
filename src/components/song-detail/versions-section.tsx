"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { formatDate, formatTime, type VersionDetail } from "./shared";

// The upload flow is only needed once the user taps "Add Recording", so its
// code stays out of the initial page chunk.
const UploadWidget = dynamic(() => import("./upload-widget"), {
  loading: () => (
    <div className="rounded-lg glass px-4 py-4 mb-3">
      <p className="text-muted-dim text-sm">Loading…</p>
    </div>
  ),
});

export function VersionsSection({
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
  const [shareToken, setShareToken] = useState<string | null>(version.share_token);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl =
    shareToken && typeof window !== "undefined"
      ? `${window.location.origin}/share/${shareToken}`
      : "";

  async function createShareLink() {
    setSharing(true);
    const res = await fetch(`/api/versions/${version.id}/share`, {
      method: "POST",
    });
    if (res.ok) {
      const data = await res.json();
      setShareToken(data.share.token);
    }
    setSharing(false);
  }

  async function revokeShareLink() {
    setSharing(true);
    const res = await fetch(`/api/versions/${version.id}/share`, {
      method: "DELETE",
    });
    if (res.ok) setShareToken(null);
    setSharing(false);
  }

  async function copyShareLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — ignore silently.
    }
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
          {shareToken && (
            <span
              className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full"
              title="A public share link is active"
            >
              Shared
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

          {/* Shareable link */}
          <div className="rounded-lg border border-border bg-surface-alt/40 px-3 py-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-foreground text-xs font-medium">
                Share link
              </span>
              {shareToken ? (
                <button
                  onClick={revokeShareLink}
                  disabled={sharing}
                  className="text-xs text-red-400 hover:text-red-300 transition disabled:opacity-50"
                >
                  {sharing ? "..." : "Revoke"}
                </button>
              ) : (
                <button
                  onClick={createShareLink}
                  disabled={sharing}
                  className="text-xs text-foreground/80 hover:text-foreground transition disabled:opacity-50"
                >
                  {sharing ? "Creating..." : "Create link"}
                </button>
              )}
            </div>
            {shareToken ? (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    onFocus={(e) => e.target.select()}
                    className="flex-1 min-w-0 rounded-md bg-surface border border-border px-2 py-1.5 text-xs text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                  <button
                    onClick={copyShareLink}
                    className="shrink-0 rounded-md border border-border-light text-foreground/80 py-1.5 px-3 text-xs hover:bg-surface transition"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <p className="text-muted-dim text-xs">
                  Anyone with this link can stream this recording. Revoke to
                  disable it.
                </p>
              </>
            ) : (
              <p className="text-muted-dim text-xs">
                Create a public link to let others hear this recording without
                signing in.
              </p>
            )}
          </div>

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
