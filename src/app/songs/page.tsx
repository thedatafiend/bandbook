import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listSongs } from "@/lib/queries";
import { SongsView } from "@/components/songs/songs-view";

/**
 * Server Component: fetches the song catalog directly from Supabase during
 * render — no client-side fetch waterfall. Interactivity (search, filters,
 * modal, deletes) lives in the SongsView client island.
 */
export default async function SongsPage() {
  const auth = await getAuthContext();

  // The proxy already redirects signed-out visitors to sign-in; reaching
  // here without auth means a signed-in user with no active band context —
  // send them to the band picker on the home page.
  if (!auth) {
    redirect("/");
  }

  const supabase = await createClient();
  const songs = await listSongs(supabase, auth.band.id);

  if (songs === null) {
    throw new Error("Failed to load songs");
  }

  return (
    <SongsView
      initialSongs={songs}
      bandName={auth.band.name}
      nickname={auth.member.nickname}
    />
  );
}
