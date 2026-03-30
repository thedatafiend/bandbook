import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test-utils/supabase-mock";

const { client: mockClient, query: mockQuery } = createMockSupabase();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

vi.mock("@/lib/session", () => ({
  getSessionCookies: vi.fn(),
}));

import { GET } from "./route";
import { getSessionCookies } from "@/lib/session";

const mockGetSession = vi.mocked(getSessionCookies);

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chaining
    for (const key of Object.keys(mockQuery)) {
      (mockQuery as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockQuery);
    }
  });

  it("returns null member/band when no session cookies", async () => {
    mockGetSession.mockResolvedValue({ sessionToken: null, bandId: null });

    const response = await GET();
    const data = await response.json();
    expect(data).toEqual({ member: null, band: null });
  });

  it("returns null when member not found", async () => {
    mockGetSession.mockResolvedValue({ sessionToken: "tok", bandId: "b1" });
    mockQuery.single.mockResolvedValueOnce({ data: null });

    const response = await GET();
    const data = await response.json();
    expect(data).toEqual({ member: null, band: null });
  });

  it("returns member and band on valid session", async () => {
    mockGetSession.mockResolvedValue({ sessionToken: "tok", bandId: "b1" });
    const member = { id: "m1", nickname: "Alex", session_token: "tok" };
    const band = { id: "b1", name: "The Band", invite_token: "inv" };

    mockQuery.single
      .mockResolvedValueOnce({ data: member })
      .mockResolvedValueOnce({ data: band });
    mockQuery.update.mockReturnValue(mockQuery);

    const response = await GET();
    const data = await response.json();
    expect(data.member).toEqual(member);
    expect(data.band).toEqual(band);
  });

  it("updates last_active_at for the member", async () => {
    mockGetSession.mockResolvedValue({ sessionToken: "tok", bandId: "b1" });
    const member = { id: "m1", nickname: "Alex" };
    const band = { id: "b1", name: "The Band", invite_token: "inv" };

    mockQuery.single
      .mockResolvedValueOnce({ data: member })
      .mockResolvedValueOnce({ data: band });

    await GET();
    expect(mockClient.from).toHaveBeenCalledWith("members");
    expect(mockQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_active_at: expect.any(String) })
    );
  });
});
