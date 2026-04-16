/**
 * Reusable skeleton / shimmer primitives for loading placeholders.
 * All components use the project's dark-theme color tokens.
 */

interface SkeletonProps {
  className?: string;
}

/** Base shimmer block — renders a rounded rectangle with a pulse animation. */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-surface-alt/60 ${className}`}
    />
  );
}

/** A text-line placeholder. Defaults to full width; use className to override. */
export function SkeletonLine({ className = "h-3 w-full" }: SkeletonProps) {
  return <Skeleton className={className} />;
}

/** A circle placeholder, useful for avatars or icons. */
export function SkeletonCircle({ className = "h-8 w-8 rounded-full" }: SkeletonProps) {
  return <Skeleton className={`!rounded-full ${className}`} />;
}

/** A card-shaped placeholder matching the project's card pattern. */
export function SkeletonCard({ className = "", children }: SkeletonProps & { children?: React.ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-lg glass px-4 py-3 ${className}`}
    >
      {children}
    </div>
  );
}
