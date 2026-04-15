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

  it("returns member and band on valid session", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockGetBandCookie.mockResolvedValue("b1");
    const member = { id: "m1", nickname: "Alex", clerk_user_id: "user_123" };
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
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockGetBandCookie.mockResolvedValue("b1");
    const member = { id: "m1", nickname: "Alex", clerk_user_id: "user_123" };
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
