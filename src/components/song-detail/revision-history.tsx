"use client";

import { useEffect, useState } from "react";
import {
  SECTION_TYPE_COLORS,
  formatDateTime,
  sectionDisplayLabel,
  type RevisionItem,
  type RevisionSnapshotSection,
} from "./shared";

export function RevisionHistory({
  songId,
  onClose,
  onRestore,
}: {
  songId: string;
  onClose: () => void;
  onRestore: (sections: RevisionSnapshotSection[], revisionId: string) => void;
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
      onRestore(data.sections as RevisionSnapshotSection[], data.revision_id);
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
                {sectionDisplayLabel(s)}
              </span>
              <p className="text-foreground/90 text-sm whitespace-pre-wrap leading-relaxed">
                {s.content || " "}
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

export default RevisionHistory;
