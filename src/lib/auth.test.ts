import { describe, it, expect, vi, beforeEach } from "vitest";

let singleCallCount = 0;
let singleResults: Array<{ data: unknown }> = [];

const mockQuery = {
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
};

// Chain everything back to mockQuery
mockQuery.select.mockReturnValue(mockQuery);
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
      { data: { id: "m1", band_id: "band-1", nickname: "Alex", clerk_user_id: "user_123" } },
      { data: null },
    ];
    expect(await getAuthContext()).toBeNull();
  });

  it("returns userId, member, and band when session is valid", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockGetBandCookie.mockResolvedValue("band-1");
    const member = { id: "m1", band_id: "band-1", nickname: "Alex", clerk_user_id: "user_123" };
    const band = { id: "band-1", name: "The Band" };
    singleResults = [{ data: member }, { data: band }];

    const result = await getAuthContext();
    expect(result).toEqual({ userId: "user_123", member, band });
  });
});
