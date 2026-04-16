import { Skeleton, SkeletonLine, SkeletonCard } from "@/components/skeleton";

/** Skeleton for the /songs page — header, search, filter pills, and song cards. */
export function SongsSkeleton() {
  return (
    <div className="flex flex-1 flex-col px-6 py-8 max-w-lg mx-auto w-full">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-9 w-9 rounded-lg" />
      </header>

      {/* Search bar */}
      <Skeleton className="h-10 w-full mb-4" />

      {/* Filter pills + sort */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex gap-1.5">
          <Skeleton className="h-7 w-12 rounded-full" />
          <Skeleton className="h-7 w-14 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>

      {/* New Song button */}
      <Skeleton className="h-12 w-full mb-4" />

      {/* Song cards */}
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SongCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function SongCardSkeleton() {
  return (
    <SkeletonCard>
      <div className="flex items-center justify-between mb-2">
        <SkeletonLine className="h-4 w-36" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex items-center gap-3">
        <SkeletonLine className="h-3 w-20" />
        <SkeletonLine className="h-3 w-14" />
        <SkeletonLine className="h-3 w-24" />
      </div>
    </SkeletonCard>
  );
}
