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

  it("returns 401 when Clerk user not found", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockCurrentUser.mockResolvedValue(null as never);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("returns empty when user has no email", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockCurrentUser.mockResolvedValue({ primaryEmailAddress: null } as never);
    const res = await POST();
    const data = await res.json();
    expect(data).toEqual({ claimed: [], count: 0 });
  });

  it("returns empty when no unlinked members match email", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockCurrentUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: "alex@band.com" },
    } as never);
    mockQuery.ilike.mockResolvedValueOnce({ data: [], error: null });

    const res = await POST();
    const data = await res.json();
    expect(data).toEqual({ claimed: [], count: 0 });
  });

  it("claims unlinked members and returns them", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockCurrentUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: "alex@band.com" },
    } as never);

    const unlinked = [
      { id: "m1", band_id: "b1", nickname: "Alex", bands: { id: "b1", name: "Rockers" } },
      { id: "m2", band_id: "b2", nickname: "Al", bands: { id: "b2", name: "Jammers" } },
    ];
    mockQuery.ilike.mockResolvedValueOnce({ data: unlinked, error: null });
    mockQuery.in.mockResolvedValueOnce({ error: null });

    const res = await POST();
    const data = await res.json();

    expect(data.count).toBe(2);
    expect(data.claimed).toEqual([
      { member_id: "m1", band_id: "b1", band_name: "Rockers", nickname: "Alex" },
      { member_id: "m2", band_id: "b2", band_name: "Jammers", nickname: "Al" },
    ]);
  });

  it("sets band cookie when exactly one band is claimed", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockCurrentUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: "alex@band.com" },
    } as never);

    const unlinked = [
      { id: "m1", band_id: "b1", nickname: "Alex", bands: { id: "b1", name: "Rockers" } },
    ];
    mockQuery.ilike.mockResolvedValueOnce({ data: unlinked, error: null });
    mockQuery.in.mockResolvedValueOnce({ error: null });

    const res = await POST();
    const data = await res.json();

    expect(data.count).toBe(1);
    expect(mockSetBandCookie).toHaveBeenCalledWith("b1");
  });

  it("does not set band cookie when multiple bands are claimed", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockCurrentUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: "alex@band.com" },
    } as never);

    const unlinked = [
      { id: "m1", band_id: "b1", nickname: "Alex", bands: { id: "b1", name: "Rockers" } },
      { id: "m2", band_id: "b2", nickname: "Al", bands: { id: "b2", name: "Jammers" } },
    ];
    mockQuery.ilike.mockResolvedValueOnce({ data: unlinked, error: null });
    mockQuery.in.mockResolvedValueOnce({ error: null });

    await POST();
    expect(mockSetBandCookie).not.toHaveBeenCalled();
  });

  it("returns 500 when update fails", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockCurrentUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: "alex@band.com" },
    } as never);

    const unlinked = [
      { id: "m1", band_id: "b1", nickname: "Alex", bands: { id: "b1", name: "Rockers" } },
    ];
    mockQuery.ilike.mockResolvedValueOnce({ data: unlinked, error: null });
    mockQuery.in.mockResolvedValueOnce({ error: new Error("fail") });

    const res = await POST();
    expect(res.status).toBe(500);
  });
});
