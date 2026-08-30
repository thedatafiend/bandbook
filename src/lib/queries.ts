import type { SupabaseClient } from "@supabase/supabase-js";
import type { SongCard } from "@/components/song-list-item";
import type {
  SongDetail,
  VersionDetail,
  LyricSectionDetail,
} from "@/components/song-detail/shared";

/**
 * Server-side data access shared by API routes and Server Components.
 * Keeping the queries here means a page rendering on the server and the
 * API route a client refreshes through return exactly the same shape.
 */

interface SongWithCounts {
  id: string;
  title: string;
  status: string;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
  created_by_member_id: string;
  versions: Array<{ count: number }>;
  lyric_sections: Array<{ count: number }>;
}

/**
 * All songs for a band with version/lyric counts aggregated in-database.
 * versions must be disambiguated via !song_id — songs and versions are
 * linked by two FKs (versions.song_id and songs.current_version_id), so a
 * bare versions(count) embed fails with PGRST201.
 */
export async function listSongs(
  supabase: SupabaseClient,
  bandId: string
): Promise<SongCard[] | null> {
  const { data: songs, error } = await supabase
    .from("songs")
    .select(
      "id, title, status, current_version_id, created_at, updated_at, created_by_member_id, versions!song_id(count), lyric_sections(count)"
    )
    .eq("band_id", bandId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("listSongs failed:", error);
    return null;
  }

  return ((songs ?? []) as unknown as SongWithCounts[]).map((song) => ({
    id: song.id,
    title: song.title,
    status: song.status,
    current_version_id: song.current_version_id,
    created_at: song.created_at,
    updated_at: song.updated_at,
    created_by_member_id: song.created_by_member_id,
    version_count: song.versions?.[0]?.count ?? 0,
    has_lyrics: (song.lyric_sections?.[0]?.count ?? 0) > 0,
  }));
}

interface VersionRow {
  id: string;
  version_number: number;
  label: string | null;
  audio_url: string;
  audio_duration: number | null;
  notes: string | null;
  is_current: boolean;
  created_at: string;
  created_by_member_id: string;
  created_by: { nickname: string } | null;
}

interface LyricSectionRow {
  id: string;
  section_type: string;
  section_label: string | null;
  content: string;
  sort_order: number;
  updated_at: string;
  updated_by_member_id: string | null;
  updated_by: { nickname: string } | null;
}

/**
 * A song with its versions (signed audio URLs, share tokens, uploader
 * nicknames) and lyric sections. Nicknames come from FK-hinted joins in
 * the same query — no separate members lookup.
 */
export async function getSongDetail(
  supabase: SupabaseClient,
  songId: string,
  bandId: string
): Promise<SongDetail | null> {
  // Fetch song, versions, and lyrics in parallel
  const [songResult, versionsResult, lyricsResult] = await Promise.all([
    supabase
      .from("songs")
      .select("*")
      .eq("id", songId)
      .eq("band_id", bandId)
      .single(),
    supabase
      .from("versions")
      .select(
        "id, version_number, label, audio_url, audio_duration, notes, is_current, created_at, created_by_member_id, created_by:members!created_by_member_id(nickname)"
      )
      .eq("song_id", songId)
      .order("version_number", { ascending: false }),
    supabase
      .from("lyric_sections")
      .select(
        "id, section_type, section_label, content, sort_order, updated_at, updated_by_member_id, updated_by:members!updated_by_member_id(nickname)"
      )
      .eq("song_id", songId)
      .order("sort_order", { ascending: true }),
  ]);

  const song = songResult.data;
  if (songResult.error || !song) {
    return null;
  }

  // A failed child query must not degrade to an empty list — rendering the
  // song with zero versions reads as data loss. Fail loudly instead so the
  // error boundary / API 500 shows and the client keeps its last good state.
  if (versionsResult.error) {
    console.error("getSongDetail versions query failed:", versionsResult.error);
    throw new Error("Failed to load song versions");
  }
  if (lyricsResult.error) {
    console.error("getSongDetail lyrics query failed:", lyricsResult.error);
    throw new Error("Failed to load song lyrics");
  }

  const versions = (versionsResult.data ?? []) as unknown as VersionRow[];
  const lyricSections = (lyricsResult.data ?? []) as unknown as LyricSectionRow[];

  // Generate signed URLs and look up active share tokens in parallel
  const audioUrls = versions.filter((v) => v.audio_url).map((v) => v.audio_url);
  const versionIds = versions.map((v) => v.id);

  const [signedUrlMap, shareMap] = await Promise.all([
    // Batch-generate signed URLs for all audio files
    (async () => {
      const map: Record<string, string> = {};
      if (audioUrls.length > 0) {
        const { data: signedData } = await supabase.storage
          .from("audio")
          .createSignedUrls(audioUrls, 3600);
        if (signedData) {
          for (const entry of signedData) {
            if (entry.signedUrl && entry.path) {
              map[entry.path] = entry.signedUrl;
            }
          }
        }
      }
      return map;
    })(),
    // Map version_id -> active (non-revoked) share token, if any
    (async () => {
      const map: Record<string, string> = {};
      if (versionIds.length > 0) {
        const { data: shares } = await supabase
          .from("recording_shares")
          .select("version_id, token")
          .is("revoked_at", null)
          .in("version_id", versionIds);
        if (shares) {
          for (const s of shares) {
            map[s.version_id] = s.token;
          }
        }
      }
      return map;
    })(),
  ]);

  const versionsWithDetails: VersionDetail[] = versions.map(
    ({ created_by, ...v }) => ({
      ...v,
      signed_audio_url: v.audio_url ? (signedUrlMap[v.audio_url] ?? null) : null,
      created_by_nickname: created_by?.nickname ?? "Unknown",
      share_token: shareMap[v.id] ?? null,
    })
  );

  const lyricSectionsWithNicknames: LyricSectionDetail[] = lyricSections.map(
    ({ updated_by, ...s }) => ({
      ...s,
      updated_by_nickname: s.updated_by_member_id
        ? updated_by?.nickname ?? "Unknown"
        : null,
    })
  );

  return {
    ...(song as SongDetail),
    versions: versionsWithDetails,
    lyric_sections: lyricSectionsWithNicknames,
  };
}

export interface UserBand {
  member_id: string;
  band_id: string;
  band_name: string;
  nickname: string;
}

/** All bands the given user belongs to. */
export async function listUserBands(
  supabase: SupabaseClient,
  userId: string
): Promise<UserBand[]> {
  const { data: memberships } = await supabase
    .from("members")
    .select("id, band_id, nickname, bands(id, name)")
    .eq("clerk_user_id", userId);

  return (memberships ?? []).map((m: Record<string, unknown>) => {
    const band = m.bands as { id: string; name: string } | null;
    return {
      member_id: m.id as string,
      band_id: m.band_id as string,
      band_name: band?.name ?? "Unknown",
      nickname: m.nickname as string,
    };
  });
}

export interface BandMember {
  id: string;
  nickname: string;
  created_at: string;
  last_active_at: string;
}

/** All members of a band, oldest first. */
export async function listBandMembers(
  supabase: SupabaseClient,
  bandId: string
): Promise<BandMember[] | null> {
  const { data: members, error } = await supabase
    .from("members")
    .select("id, nickname, created_at, last_active_at")
    .eq("band_id", bandId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("listBandMembers failed:", error);
    return null;
  }
  return members ?? [];
}
