export type SongStatus = "draft" | "in-progress" | "finished";
export type SectionType =
  | "verse"
  | "chorus"
  | "pre-chorus"
  | "bridge"
  | "intro"
  | "outro"
  | "custom";

export interface Band {
  id: string;
  name: string;
  passcode_hash: string;
  invite_token: string;
  created_at: string;
}

export type MembershipRole = "admin" | "member" | "viewer";

export interface Member {
  id: string;
  band_id: string;
  nickname: string;
  email: string;
  session_token: string;
  clerk_user_id: string | null;
  role: MembershipRole;
  created_at: string;
  last_active_at: string;
}

export interface Song {
  id: string;
  band_id: string;
  title: string;
  status: SongStatus;
  bpm: number | null;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
  created_by_member_id: string;
}

export interface Version {
  id: string;
  song_id: string;
  version_number: number;
  label: string | null;
  audio_url: string;
  audio_duration: number | null;
  notes: string | null;
  is_current: boolean;
  created_at: string;
  created_by_member_id: string;
}

export interface LyricSection {
  id: string;
  song_id: string;
  section_type: SectionType;
  section_label: string | null;
  content: string;
  sort_order: number;
  updated_at: string;
  updated_by_member_id: string;
}

export interface LyricRevision {
  id: string;
  song_id: string;
  snapshot: Record<string, unknown>;
  created_at: string;
  created_by_member_id: string;
  revision_note: string | null;
}
