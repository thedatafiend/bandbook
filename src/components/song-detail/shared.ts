/** Shared types, constants, and format helpers for the song detail view. */

export interface VersionDetail {
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
  share_token: string | null;
}

export interface LyricSectionDetail {
  id: string;
  section_type: string;
  section_label: string | null;
  content: string;
  sort_order: number;
  updated_at: string;
  updated_by_nickname: string | null;
}

export interface SongDetail {
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

export interface RevisionSnapshotSection {
  section_type: string;
  section_label: string | null;
  content: string;
  sort_order: number;
}

export interface RevisionItem {
  id: string;
  snapshot: { sections: RevisionSnapshotSection[] };
  created_at: string;
  created_by_nickname: string;
  revision_note: string | null;
}

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  "in-progress": "In Progress",
  finished: "Finished",
};

export const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "in-progress", label: "In Progress" },
  { value: "finished", label: "Finished" },
];

export const SECTION_TYPE_COLORS: Record<string, string> = {
  verse: "bg-blue-500/20 text-blue-300",
  chorus: "bg-fuchsia-500/20 text-fuchsia-300",
  "pre-chorus": "bg-indigo-500/20 text-indigo-300",
  bridge: "bg-amber-500/20 text-amber-300",
  intro: "bg-teal-500/20 text-teal-300",
  outro: "bg-rose-500/20 text-rose-300",
  custom: "bg-surface-alt/60 text-muted",
};

export const SECTION_TYPES: Array<{ value: string; label: string }> = [
  { value: "verse", label: "Verse" },
  { value: "chorus", label: "Chorus" },
  { value: "pre-chorus", label: "Pre-Chorus" },
  { value: "bridge", label: "Bridge" },
  { value: "intro", label: "Intro" },
  { value: "outro", label: "Outro" },
  { value: "custom", label: "Custom" },
];

export function sectionDisplayLabel(section: {
  section_type: string;
  section_label: string | null;
}): string {
  return (
    section.section_label ??
    section.section_type.charAt(0).toUpperCase() + section.section_type.slice(1)
  );
}

export async function readError(res: Response, fallback: string): Promise<string> {
  // Surface the actual server error when the body is JSON; otherwise include
  // the HTTP status and a snippet so we don't collapse every failure into the
  // same generic message.
  try {
    const data = await res.clone().json();
    if (data?.error) return String(data.error);
  } catch {
    // not JSON
  }
  const text = (await res.text().catch(() => "")).slice(0, 200).trim();
  return `${fallback} (HTTP ${res.status})${text ? `: ${text}` : ""}`;
}

export function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
