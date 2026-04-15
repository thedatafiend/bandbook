import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted runs at the same time as vi.mock (hoisted to top)
const { container, mockProtect } = vi.hoisted(() => {
  const container: {
    handler: ((auth: unknown, request: unknown) => Promise<void>) | null;
  } = { handler: null };
  const mockProtect = vi.fn();
  return { container, mockProtect };
});

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: vi.fn((handler: unknown) => {
    container.handler = handler as typeof container.handler;
    return () => {};
  }),
  createRouteMatcher: vi.fn((routes: string[]) => {
    return (request: { nextUrl: { pathname: string } }) => {
      return routes.some((route) => {
        const pattern = route.replace("(.*)", ".*");
        return new RegExp(`^${pattern}$`).test(request.nextUrl.pathname);
      });
    };
  }),
}));

// Import triggers module execution and registers the handler
import "./proxy";

function createRequest(pathname: string) {
  return {
    nextUrl: { pathname },
  };
}

function createAuthFn() {
  return {
    protect: mockProtect,
  };
}

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a middleware handler", () => {
    expect(container.handler).not.toBeNull();
  });

  it("does not protect public sign-in routes", async () => {
    await container.handler!(createAuthFn(), createRequest("/sign-in"));
    expect(mockProtect).not.toHaveBeenCalled();
  });

  it("does not protect public sign-up routes", async () => {
    await container.handler!(createAuthFn(), createRequest("/sign-up"));
    expect(mockProtect).not.toHaveBeenCalled();
  });

  it("does not protect getting-started page", async () => {
    await container.handler!(createAuthFn(), createRequest("/getting-started"));
    expect(mockProtect).not.toHaveBeenCalled();
  });

  it("protects /songs route", async () => {
    await container.handler!(createAuthFn(), createRequest("/songs"));
    expect(mockProtect).toHaveBeenCalled();
  });

  it("protects /settings route", async () => {
    await container.handler!(createAuthFn(), createRequest("/settings"));
    expect(mockProtect).toHaveBeenCalled();
  });

  it("protects /api/songs route", async () => {
    await container.handler!(createAuthFn(), createRequest("/api/songs"));
    expect(mockProtect).toHaveBeenCalled();
  });

  it("does not protect root route (public landing page)", async () => {
    await container.handler!(createAuthFn(), createRequest("/"));
    expect(mockProtect).not.toHaveBeenCalled();
  });

  it("does not protect join routes", async () => {
    await container.handler!(createAuthFn(), createRequest("/join/abc123"));
    expect(mockProtect).not.toHaveBeenCalled();
  });
});
