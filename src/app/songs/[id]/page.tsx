import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSongDetail } from "@/lib/queries";
import { SongDetailView } from "@/components/song-detail/song-detail-view";

/**
 * Server Component: fetches the song (versions, signed audio URLs, lyrics)
 * directly from Supabase during render. The interactive view — player,
 * tabs, editors — is the SongDetailView client island, seeded with this
 * data so there is no client-side fetch on first paint.
 */
export default async function SongDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const auth = await getAuthContext();
  if (!auth) {
    redirect("/");
  }

  const supabase = await createClient();
  const song = await getSongDetail(supabase, id, auth.band.id);

  if (!song) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center">
        <p className="text-muted mb-4">Song not found</p>
        <Link href="/songs" className="text-foreground hover:underline">
          Back to catalog
        </Link>
      </main>
    );
  }

  return <SongDetailView initialSong={song} />;
}
