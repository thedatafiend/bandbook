import { describe, it, expect, vi, beforeEach } from "vitest";

let singleCallCount = 0;
let singleResults: Array<{ data: unknown }> = [];

const mockQuery = {
  select: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
};

// Chain everything back to mockQuery
mockQuery.select.mockReturnValue(mockQuery);
mockQuery.update.mockReturnValue(mockQuery);
mockQuery.eq.mockReturnValue(mockQuery);
mockQuery.single.mockImplementation(() => {
  const result = singleResults[singleCallCount] ?? { data: null };
  singleCallCount++;
  return Promise.resolve(result);
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve({ from: () => mockQuery })),
}));

vi.mock("@/lib/session", () => ({
  getBandCookie: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

import { getAuthContext } from "./auth";
import { getBandCookie } from "@/lib/session";
import { auth } from "@clerk/nextjs/server";

const mockGetBandCookie = vi.mocked(getBandCookie);
const mockAuth = vi.mocked(auth);

describe("getAuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    singleCallCount = 0;
    singleResults = [];
    // Re-setup chaining after clearAllMocks
    mockQuery.select.mockReturnValue(mockQuery);
    mockQuery.update.mockReturnValue(mockQuery);
    mockQuery.eq.mockReturnValue(mockQuery);
    mockQuery.single.mockImplementation(() => {
      const result = singleResults[singleCallCount] ?? { data: null };
      singleCallCount++;
      return Promise.resolve(result);
    });
  });

  it("returns null when Clerk session has no userId", async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);
    expect(await getAuthContext()).toBeNull();
  });

  it("returns null when band cookie is missing", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockGetBandCookie.mockResolvedValue(null);
    expect(await getAuthContext()).toBeNull();
  });

  it("returns null when member not found for clerk_user_id + band_id", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockGetBandCookie.mockResolvedValue("band-1");
    singleResults = [{ data: null }];
    expect(await getAuthContext()).toBeNull();
  });

  it("returns null when band not found", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockGetBandCookie.mockResolvedValue("band-1");
    singleResults = [
      { data: { id: "m1", band_id: "band-1", nickname: "Alex", clerk_user_id: "user_123", bands: null } },
    ];
    expect(await getAuthContext()).toBeNull();
  });

  it("returns userId, member, and band when session is valid", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockGetBandCookie.mockResolvedValue("band-1");
    const member = {
      id: "m1",
      band_id: "band-1",
      nickname: "Alex",
      clerk_user_id: "user_123",
      last_active_at: new Date().toISOString(),
    };
    const band = { id: "band-1", name: "The Band" };
    singleResults = [{ data: { ...member, bands: band } }];

    const result = await getAuthContext();
    expect(result).toEqual({ userId: "user_123", member, band });
  });

  it("fetches member and band in a single query", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockGetBandCookie.mockResolvedValue("band-1");
    const member = {
      id: "m1",
      band_id: "band-1",
      nickname: "Alex",
      clerk_user_id: "user_123",
      last_active_at: new Date().toISOString(),
    };
    singleResults = [{ data: { ...member, bands: { id: "band-1", name: "The Band" } } }];

    await getAuthContext();
    expect(mockQuery.select).toHaveBeenCalledWith("*, bands(*)");
    expect(mockQuery.single).toHaveBeenCalledTimes(1);
  });

  it("touches last_active_at when stale, and skips the write when recent", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockGetBandCookie.mockResolvedValue("band-1");
    const band = { id: "band-1", name: "The Band" };

    // Stale → write
    const staleMember = {
      id: "m1",
      band_id: "band-1",
      nickname: "Alex",
      clerk_user_id: "user_123",
      last_active_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    };
    singleResults = [{ data: { ...staleMember, bands: band } }];
    await getAuthContext();
    expect(mockQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_active_at: expect.any(String) })
    );

    // Recent → no write
    mockQuery.update.mockClear();
    singleCallCount = 0;
    singleResults = [
      {
        data: {
          ...staleMember,
          last_active_at: new Date().toISOString(),
          bands: band,
        },
      },
    ];
    await getAuthContext();
    expect(mockQuery.update).not.toHaveBeenCalled();
  });
});
