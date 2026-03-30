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
  getSessionCookies: vi.fn(),
}));

import { getAuthContext } from "./auth";
import { getSessionCookies } from "@/lib/session";

const mockGetSessionCookies = vi.mocked(getSessionCookies);

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

  it("returns null when no session cookies", async () => {
    mockGetSessionCookies.mockResolvedValue({ sessionToken: null, bandId: null });
    expect(await getAuthContext()).toBeNull();
  });

  it("returns null when session token is missing", async () => {
    mockGetSessionCookies.mockResolvedValue({ sessionToken: null, bandId: "band-1" });
    expect(await getAuthContext()).toBeNull();
  });

  it("returns null when band ID is missing", async () => {
    mockGetSessionCookies.mockResolvedValue({ sessionToken: "tok", bandId: null });
    expect(await getAuthContext()).toBeNull();
  });

  it("returns null when member not found", async () => {
    mockGetSessionCookies.mockResolvedValue({ sessionToken: "tok", bandId: "band-1" });
    singleResults = [{ data: null }];
    expect(await getAuthContext()).toBeNull();
  });

  it("returns null when band not found", async () => {
    mockGetSessionCookies.mockResolvedValue({ sessionToken: "tok", bandId: "band-1" });
    singleResults = [
      { data: { id: "m1", band_id: "band-1", nickname: "Alex" } },
      { data: null },
    ];
    expect(await getAuthContext()).toBeNull();
  });

  it("returns member and band when session is valid", async () => {
    mockGetSessionCookies.mockResolvedValue({ sessionToken: "tok", bandId: "band-1" });
    const member = { id: "m1", band_id: "band-1", nickname: "Alex" };
    const band = { id: "band-1", name: "The Band" };
    singleResults = [{ data: member }, { data: band }];

    const result = await getAuthContext();
    expect(result).toEqual({ member, band });
  });
});
