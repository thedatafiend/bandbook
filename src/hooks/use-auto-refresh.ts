"use client";

import { useEffect, useRef } from "react";

interface UseAutoRefreshOptions {
  /** Also fire once on mount (e.g. to bust a stale Router Cache entry). */
  refreshOnMount?: boolean;
  /** Poll every N ms while the tab is visible. */
  intervalMs?: number;
}

// Switching back to a tab fires both `focus` and `visibilitychange`;
// coalesce anything inside this window into a single refresh.
const MIN_GAP_MS = 1_000;

/**
 * Re-runs `refresh` whenever the tab regains focus or becomes visible —
 * optionally on mount and on a polling interval while visible — so
 * server-rendered data edited elsewhere (another tab, another band member)
 * converges without a manual reload.
 */
export function useAutoRefresh(
  refresh: () => void,
  { refreshOnMount = false, intervalMs }: UseAutoRefreshOptions = {}
) {
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const lastRunRef = useRef(0);

  useEffect(() => {
    function run() {
      const now = Date.now();
      if (now - lastRunRef.current < MIN_GAP_MS) return;
      lastRunRef.current = now;
      refreshRef.current();
    }

    if (refreshOnMount) run();

    function handleFocus() {
      run();
    }
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") run();
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const interval = intervalMs
      ? setInterval(() => {
          if (document.visibilityState === "visible") run();
        }, intervalMs)
      : undefined;

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (interval !== undefined) clearInterval(interval);
    };
  }, [refreshOnMount, intervalMs]);
}
