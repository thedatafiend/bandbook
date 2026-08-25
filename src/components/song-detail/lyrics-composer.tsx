"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import {
  SECTION_TYPES,
  SECTION_TYPE_COLORS,
  sectionDisplayLabel,
  type LyricSectionDetail,
  type RevisionSnapshotSection,
} from "./shared";

// Revision history is only needed when the user opens it — keep its code
// out of the initial page chunk.
const RevisionHistory = dynamic(() => import("./revision-history"), {
  loading: () => (
    <p className="text-muted-dim text-sm text-center py-8">Loading...</p>
  ),
});

interface EditableSection {
  clientId: string;
  id?: string;
  section_type: string;
  section_label: string | null;
  content: string;
  sort_order: number;
}

let clientIdCounter = 0;
function newClientId() {
  return `c_${++clientIdCounter}_${Date.now()}`;
}

export function LyricsComposer({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          // ?latest=1 returns only the newest revision's metadata — no
          // need to download full snapshots just to compare IDs.
          const res = await fetch(`/api/songs/${songId}/lyrics/revisions?latest=1`);
          const data = await res.json();
          const latest = data.latest as { id: string; created_by_nickname: string } | null;
          if (latest) {
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
        const res = await fetch(`/api/songs/${songId}/lyrics/revisions?latest=1`);
        const data = await res.json();
        const latest = data.latest as { id: string } | null;
        if (latest) {
          latestRevisionIdRef.current = latest.id;
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
                  {sectionDisplayLabel(section)}
                </span>
                <p className="text-foreground text-xl whitespace-pre-wrap leading-relaxed font-light">
                  {section.content || " "}
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
        onRestore={(restoredSections: RevisionSnapshotSection[], revisionId: string) => {
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
                    {sectionDisplayLabel(section)}
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

export default LyricsComposer;
