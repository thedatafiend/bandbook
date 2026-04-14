import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test-utils/supabase-mock";

const { client: mockClient, query: mockQuery } = createMockSupabase();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

vi.mock("@/lib/session", () => ({
  setBandCookie: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

import { POST } from "./route";
import { auth, currentUser } from "@clerk/nextjs/server";
import { setBandCookie } from "@/lib/session";

const mockAuth = vi.mocked(auth);
const mockCurrentUser = vi.mocked(currentUser);
const mockSetBandCookie = vi.mocked(setBandCookie);

describe("POST /api/auth/claim-memberships", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockQuery)) {
      (mockQuery as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockQuery);
    }
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("returns empty when user has no memberships", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockCurrentUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: "alex@band.com" },
    } as never);
    // No unclaimed members
    mockQuery.ilike.mockResolvedValueOnce({ data: [], error: null });
    // No existing memberships
    mockQuery.eq.mockResolvedValueOnce({ data: [], error: null });

    const res = await POST();
    const data = await res.json();
    expect(data).toEqual({ bands: [], count: 0 });
  });

  it("claims unclaimed members and returns all bands", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockCurrentUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: "alex@band.com" },
    } as never);

    // Unclaimed members found
    const unclaimed = [{ id: "m1" }];
    mockQuery.ilike.mockResolvedValueOnce({ data: unclaimed, error: null });
    // Claim update succeeds
    mockQuery.in.mockResolvedValueOnce({ error: null });
    // All memberships query returns the now-claimed member
    const allMemberships = [
      { id: "m1", band_id: "b1", nickname: "Alex", bands: { id: "b1", name: "Rockers" } },
    ];
    mockQuery.eq.mockResolvedValueOnce({ data: allMemberships, error: null });

    const res = await POST();
    const data = await res.json();

    expect(data.count).toBe(1);
    expect(data.bands).toEqual([
      { member_id: "m1", band_id: "b1", band_name: "Rockers", nickname: "Alex" },
    ]);
  });

  it("returns existing bands even when nothing to claim", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockCurrentUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: "alex@band.com" },
    } as never);

    // No unclaimed members
    mockQuery.ilike.mockResolvedValueOnce({ data: [], error: null });
    // Already-linked memberships exist
    const existing = [
      { id: "m1", band_id: "b1", nickname: "Alex", bands: { id: "b1", name: "Rockers" } },
      { id: "m2", band_id: "b2", nickname: "Al", bands: { id: "b2", name: "Jammers" } },
    ];
    mockQuery.eq.mockResolvedValueOnce({ data: existing, error: null });

    const res = await POST();
    const data = await res.json();

    expect(data.count).toBe(2);
    expect(data.bands).toHaveLength(2);
  });

  it("sets band cookie when user has exactly one band", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockCurrentUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: "alex@band.com" },
    } as never);

    mockQuery.ilike.mockResolvedValueOnce({ data: [], error: null });
    const existing = [
      { id: "m1", band_id: "b1", nickname: "Alex", bands: { id: "b1", name: "Rockers" } },
    ];
    mockQuery.eq.mockResolvedValueOnce({ data: existing, error: null });

    await POST();
    expect(mockSetBandCookie).toHaveBeenCalledWith("b1");
  });

  it("does not set band cookie when user has multiple bands", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockCurrentUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: "alex@band.com" },
    } as never);

    mockQuery.ilike.mockResolvedValueOnce({ data: [], error: null });
    const existing = [
      { id: "m1", band_id: "b1", nickname: "Alex", bands: { id: "b1", name: "Rockers" } },
      { id: "m2", band_id: "b2", nickname: "Al", bands: { id: "b2", name: "Jammers" } },
    ];
    mockQuery.eq.mockResolvedValueOnce({ data: existing, error: null });

    await POST();
    expect(mockSetBandCookie).not.toHaveBeenCalled();
  });

  it("skips claim step when user has no email", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockCurrentUser.mockResolvedValue({
      primaryEmailAddress: null,
    } as never);

    // Should skip straight to membership query (no ilike call)
    const existing = [
      { id: "m1", band_id: "b1", nickname: "Alex", bands: { id: "b1", name: "Rockers" } },
    ];
    mockQuery.eq.mockResolvedValueOnce({ data: existing, error: null });

    const res = await POST();
    const data = await res.json();

    expect(data.count).toBe(1);
    expect(mockQuery.ilike).not.toHaveBeenCalled();
  });
});
