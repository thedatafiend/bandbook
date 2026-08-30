import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { useAutoRefresh } from "./use-auto-refresh";

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

describe("useAutoRefresh", () => {
  let now: number;

  beforeEach(() => {
    // Controllable clock so the coalescing window can be stepped over
    now = 100_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    setVisibility("visible");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("does not fire on mount by default", () => {
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh(refresh));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("fires on mount when refreshOnMount is set", () => {
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh(refresh, { refreshOnMount: true }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("fires when the window regains focus", () => {
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh(refresh));

    window.dispatchEvent(new Event("focus"));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("fires when the tab becomes visible, but not when it hides", () => {
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh(refresh));

    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).not.toHaveBeenCalled();

    now += 5_000;
    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("coalesces focus and visibilitychange fired together into one refresh", () => {
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh(refresh));

    // A tab switch fires both events back-to-back
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    expect(refresh).toHaveBeenCalledTimes(1);

    // A later focus (past the coalescing window) fires again
    now += 5_000;
    window.dispatchEvent(new Event("focus"));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("polls on the given interval while visible", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh(refresh, { intervalMs: 60_000 }));

    now += 60_000;
    vi.advanceTimersByTime(60_000);
    expect(refresh).toHaveBeenCalledTimes(1);

    now += 60_000;
    vi.advanceTimersByTime(60_000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("skips interval ticks while the tab is hidden", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh(refresh, { intervalMs: 60_000 }));

    setVisibility("hidden");
    now += 60_000;
    vi.advanceTimersByTime(60_000);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("stops listening after unmount", () => {
    const refresh = vi.fn();
    const { unmount } = renderHook(() => useAutoRefresh(refresh));

    unmount();
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("always calls the latest refresh callback", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) => useAutoRefresh(cb),
      { initialProps: { cb: first } }
    );

    rerender({ cb: second });
    window.dispatchEvent(new Event("focus"));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
