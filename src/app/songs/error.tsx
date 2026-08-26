"use client";

export default function SongsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <p className="text-muted mb-4">Couldn&apos;t load your songs.</p>
      <button
        onClick={() => reset()}
        className="rounded-lg border border-border-light text-foreground font-semibold py-2 px-4 hover:bg-surface-alt transition"
      >
        Try again
      </button>
    </main>
  );
}
