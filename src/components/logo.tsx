/**
 * BandBook logo — the music-note mark used for the favicon, reusable at any size.
 * `LogoMark` is the standalone square; `Logo` pairs it with the wordmark for a
 * full lockup. Both track the project's `accent` color token so rebranding the
 * mark stays a one-file change (kept visually in sync with src/app/icon.svg).
 */

interface LogoMarkProps {
  /** Pixel size of the square mark. Defaults to 32. */
  size?: number;
  /** Hide from assistive tech (use when an adjacent wordmark provides the label). */
  decorative?: boolean;
  className?: string;
}

/** The standalone square music-note mark. Matches src/app/icon.svg. */
export function LogoMark({ size = 32, decorative = false, className = "" }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": "BandBook" })}
    >
      <rect width="32" height="32" rx="6" className="fill-accent" />
      <text x="16" y="23" textAnchor="middle" fontSize="20" fill="white">
        ♪
      </text>
    </svg>
  );
}

interface LogoProps {
  /** Pixel size of the square mark. Defaults to 32. */
  size?: number;
  /** Render the "BandBook" wordmark next to the mark. */
  withWordmark?: boolean;
  className?: string;
}

/** Logo lockup: the music-note mark, optionally followed by the wordmark. */
export function Logo({ size = 32, withWordmark = false, className = "" }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} decorative={withWordmark} />
      {withWordmark && (
        <span
          className="font-bold tracking-tight text-foreground"
          style={{ fontSize: size * 0.7 }}
        >
          BandBook
        </span>
      )}
    </span>
  );
}
