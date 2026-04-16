import { Skeleton, SkeletonLine, SkeletonCard } from "@/components/skeleton";

/** Skeleton for the /settings page — header + five setting sections. */
export function SettingsSkeleton() {
  return (
    <div className="flex flex-1 flex-col px-6 py-8 max-w-lg mx-auto w-full">
      {/* Header: back arrow + title */}
      <header className="flex items-center gap-4 mb-8">
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-7 w-36" />
      </header>

      <div className="flex flex-col gap-8">
        {/* Band Name */}
        <SettingSectionSkeleton titleWidth="w-24">
          <SkeletonCard>
            <div className="flex items-center justify-between">
              <SkeletonLine className="h-4 w-32" />
              <SkeletonLine className="h-4 w-8" />
            </div>
          </SkeletonCard>
        </SettingSectionSkeleton>

        {/* Invite Link */}
        <SettingSectionSkeleton titleWidth="w-24">
          <SkeletonLine className="h-3 w-3/4 mb-4" />
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-11 flex-1" />
            <Skeleton className="h-11 w-16" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-36" />
          </div>
        </SettingSectionSkeleton>

        {/* Change Passcode */}
        <SettingSectionSkeleton titleWidth="w-36">
          <SkeletonLine className="h-3 w-full mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </SettingSectionSkeleton>

        {/* Members */}
        <SettingSectionSkeleton titleWidth="w-28">
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <MemberCardSkeleton key={i} />
            ))}
          </div>
        </SettingSectionSkeleton>

        {/* Your Bands */}
        <SettingSectionSkeleton titleWidth="w-24">
          <div className="flex flex-col gap-2 mb-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <SkeletonCard key={i}>
                <div className="flex items-center justify-between">
                  <div className="space-y-1.5">
                    <SkeletonLine className="h-4 w-28" />
                    <SkeletonLine className="h-3 w-20" />
                  </div>
                  <SkeletonLine className="h-4 w-14" />
                </div>
              </SkeletonCard>
            ))}
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
          </div>
        </SettingSectionSkeleton>
      </div>
    </div>
  );
}

function SettingSectionSkeleton({
  titleWidth,
  children,
}: {
  titleWidth: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <Skeleton className={`h-5 ${titleWidth} mb-3`} />
      {children}
    </section>
  );
}

function MemberCardSkeleton() {
  return (
    <SkeletonCard>
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <SkeletonLine className="h-4 w-24" />
          <SkeletonLine className="h-3 w-32" />
        </div>
        <SkeletonLine className="h-3 w-16" />
      </div>
    </SkeletonCard>
  );
}
