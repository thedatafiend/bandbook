import { Skeleton, SkeletonLine, SkeletonCard } from "@/components/skeleton";

/** Skeleton for the /songs/[id] page — header, audio player, tabs, version cards. */
export function SongDetailSkeleton() {
  return (
    <div className="flex flex-1 flex-col px-6 py-8 max-w-lg mx-auto w-full">
      {/* Header: back arrow + title + status */}
      <header className="flex items-center gap-3 mb-6">
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-5 w-16 rounded-full ml-auto" />
      </header>

      {/* Audio player card */}
      <SkeletonCard className="mb-6 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <SkeletonLine className="h-3 w-32" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
          <SkeletonLine className="h-3 w-10" />
        </div>
      </SkeletonCard>

      {/* Tab bar */}
      <div className="flex gap-6 border-b border-border mb-6">
        <Skeleton className="h-8 w-20 rounded-t" />
        <Skeleton className="h-8 w-16 rounded-t" />
      </div>

      {/* Version cards */}
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <VersionCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function VersionCardSkeleton() {
  return (
    <SkeletonCard className="space-y-2">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <SkeletonLine className="h-4 w-28" />
          <SkeletonLine className="h-3 w-40" />
        </div>
      </div>
    </SkeletonCard>
  );
}
