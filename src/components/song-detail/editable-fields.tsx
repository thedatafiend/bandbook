"use client";

import { useEffect, useState, useRef } from "react";
import { STATUS_LABELS, STATUS_OPTIONS } from "./shared";

/* ─── Editable Title ─── */

export function EditableTitle({
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

export function EditableStatus({
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

export function EditableBpm({
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
