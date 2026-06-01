import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSharedRecording } from "@/lib/shares";
import { SharePlayer } from "@/components/share-player";

export const metadata: Metadata = {
  title: "Shared recording · BandBook",
  // 3rd-party links shouldn't be indexed.
  robots: { index: false, follow: false },
};

export default async function SharedRecordingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const recording = await getSharedRecording(supabase, token);

  if (!recording) {
    notFound();
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <SharePlayer
        token={token}
        title={recording.title}
        versionNumber={recording.versionNumber}
        label={recording.label}
        durationSeconds={recording.durationSeconds}
        initialAudioUrl={recording.signedAudioUrl}
      />
      <p className="text-muted-dim text-xs mt-8">
        Powered by{" "}
        <span className="text-muted">BandBook</span>
      </p>
    </main>
  );
}
