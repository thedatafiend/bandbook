import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test-utils/supabase-mock";

const { client: mockClient, query: mockQuery } = createMockSupabase();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

vi.mock("@/lib/session", () => ({
  getBandCookie: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

import { GET } from "./route";
import { getBandCookie } from "@/lib/session";
import { auth } from "@clerk/nextjs/server";

const mockGetBandCookie = vi.mocked(getBandCookie);
const mockAuth = vi.mocked(auth);

const band = { id: "b1", name: "The Band", invite_token: "inv" };

function memberRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "m1",
    nickname: "Alex",
    clerk_user_id: "user_123",
    last_active_at: new Date().toISOString(),
    bands: band,
    ...overrides,
  };
}

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chaining
    for (const key of Object.keys(mockQuery)) {
      (mockQuery as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockQuery);
    }
  });

  it("returns null member/band when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const response = await GET();
    const data = await response.json();
    expect(data).toEqual({ member: null, band: null });
  });

  it("returns null member/band when no band cookie", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockGetBandCookie.mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();
    expect(data).toEqual({ member: null, band: null });
  });

  it("returns 401 with expired flag when member not found", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockGetBandCookie.mockResolvedValue("b1");
    mockQuery.single.mockResolvedValueOnce({ data: null });

    const response = await GET();
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data).toEqual({ member: null, band: null, expired: true });
  });

  it("returns member and band from a single joined query", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockGetBandCookie.mockResolvedValue("b1");
    const row = memberRow();
    mockQuery.single.mockResolvedValueOnce({ data: row });

    const response = await GET();
    const data = await response.json();
    // toEqual treats undefined properties as absent — the response member
    // must not carry the embedded bands object.
    expect(data.member).toEqual({ ...row, bands: undefined });
    expect(data.band).toEqual(band);
    expect(mockQuery.single).toHaveBeenCalledTimes(1);
  });

  it("updates last_active_at when it is stale", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockGetBandCookie.mockResolvedValue("b1");
    const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    mockQuery.single.mockResolvedValueOnce({
      data: memberRow({ last_active_at: staleTime }),
    });

    await GET();
    expect(mockQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_active_at: expect.any(String) })
    );
  });

  it("skips the last_active_at write when it was updated recently", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockGetBandCookie.mockResolvedValue("b1");
    mockQuery.single.mockResolvedValueOnce({
      data: memberRow({ last_active_at: new Date().toISOString() }),
    });

    await GET();
    expect(mockQuery.update).not.toHaveBeenCalled();
  });
});
