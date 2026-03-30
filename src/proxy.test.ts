import { describe, it, expect, vi, beforeEach } from "vitest";

// Manually track calls
let nextCalled = false;
let redirectUrl: string | null = null;

vi.mock("next/server", () => ({
  NextResponse: {
    next: () => {
      nextCalled = true;
      return { type: "next" };
    },
    redirect: (url: URL) => {
      redirectUrl = url.pathname;
      return { type: "redirect", url };
    },
  },
}));

import proxy from "./proxy";
import type { NextRequest } from "next/server";

function createRequest(pathname: string, cookies: Record<string, string> = {}): NextRequest {
  return {
    cookies: {
      get: (name: string) => {
        const value = cookies[name];
        return value ? { value } : undefined;
      },
    },
    nextUrl: {
      pathname,
      clone: () => {
        const url = new URL(`http://localhost:3000${pathname}`);
        return url;
      },
    },
  } as unknown as NextRequest;
}

describe("proxy", () => {
  beforeEach(() => {
    nextCalled = false;
    redirectUrl = null;
  });

  it("lets API routes through without checking auth", () => {
    proxy(createRequest("/api/songs"));
    expect(nextCalled).toBe(true);
    expect(redirectUrl).toBeNull();
  });

  it("lets unauthenticated users access the landing page", () => {
    proxy(createRequest("/"));
    expect(nextCalled).toBe(true);
    expect(redirectUrl).toBeNull();
  });

  it("lets unauthenticated users access join pages", () => {
    proxy(createRequest("/join/abc123"));
    expect(nextCalled).toBe(true);
    expect(redirectUrl).toBeNull();
  });

  it("redirects unauthenticated users to landing from protected pages", () => {
    proxy(createRequest("/songs"));
    expect(redirectUrl).toBe("/");
  });

  it("redirects unauthenticated users from settings to landing", () => {
    proxy(createRequest("/settings"));
    expect(redirectUrl).toBe("/");
  });

  it("redirects authenticated users from landing to /songs", () => {
    proxy(createRequest("/", { bb_session: "tok", bb_band: "band" }));
    expect(redirectUrl).toBe("/songs");
  });

  it("redirects authenticated users from /join to /songs", () => {
    proxy(createRequest("/join/abc", { bb_session: "tok", bb_band: "band" }));
    expect(redirectUrl).toBe("/songs");
  });

  it("lets authenticated users access protected pages", () => {
    proxy(createRequest("/songs", { bb_session: "tok", bb_band: "band" }));
    expect(nextCalled).toBe(true);
    expect(redirectUrl).toBeNull();
  });

  it("redirects when only session cookie is present (missing band)", () => {
    proxy(createRequest("/songs", { bb_session: "tok" }));
    expect(redirectUrl).toBe("/");
  });

  it("redirects when only band cookie is present (missing session)", () => {
    proxy(createRequest("/songs", { bb_band: "band" }));
    expect(redirectUrl).toBe("/");
  });
});
