import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** How long signed audio URLs handed to public listeners stay valid (seconds). */
export const SHARE_SIGNED_URL_TTL = 60 * 60 * 6; // 6 hours

/**
 * Generate an unguessable, URL-safe token for a public share link.
 * 24 random bytes => 192 bits of entropy, encoded base64url (no padding).
 */
export function generateShareToken(): string {
  return randomBytes(24).toString("base64url");
}

export interface SharedRecording {
  title: string;
  versionNumber: number;
  label: string | null;
  durationSeconds: number | null;
  signedAudioUrl: string;
}

/**
 * Resolve a public share token to its recording, or null if the token is
 * unknown, revoked, or the underlying audio is missing.
 *
 * Deliberately returns only what a 3rd party is allowed to see — song title,
 * version label/number, duration, and a short-lived streaming URL. No band,
 * song list, lyrics, notes, or other versions are exposed.
 */
export async function getSharedRecording(
  supabase: SupabaseClient,
  token: string
): Promise<SharedRecording | null> {
  if (!token) return null;

  const { data: share } = await supabase
    .from("recording_shares")
    .select("version_id, revoked_at")
    .eq("token", token)
    .is("revoked_at", null)
    .single();

  if (!share) return null;

  const { data: version } = await supabase
    .from("versions")
    .select("audio_url, audio_duration, label, version_number, song_id")
    .eq("id", share.version_id)
    .single();

  if (!version || !version.audio_url) return null;

  const { data: song } = await supabase
    .from("songs")
    .select("title")
    .eq("id", version.song_id)
    .single();

  if (!song) return null;

  const { data: signed } = await supabase.storage
    .from("audio")
    .createSignedUrl(version.audio_url, SHARE_SIGNED_URL_TTL);

  if (!signed?.signedUrl) return null;

  return {
    title: song.title,
    versionNumber: version.version_number,
    label: version.label ?? null,
    durationSeconds: version.audio_duration ?? null,
    signedAudioUrl: signed.signedUrl,
  };
}
