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
}));

import { POST } from "./route";
import { auth } from "@clerk/nextjs/server";
import { setBandCookie } from "@/lib/session";

const mockAuth = vi.mocked(auth);
const mockSetBandCookie = vi.mocked(setBandCookie);

function makeReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/auth/switch-band", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/auth/switch-band", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockQuery)) {
      (mockQuery as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockQuery);
    }
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);
    const res = await POST(makeReq({ bandId: "b1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when band ID is missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 403 when user is not a member of the band", async () => {
    mockQuery.single.mockResolvedValueOnce({ data: null, error: new Error("not found") });
    const res = await POST(makeReq({ bandId: "b1" }));
    expect(res.status).toBe(403);
  });

  it("sets band cookie and returns ok on success", async () => {
    mockQuery.single.mockResolvedValueOnce({
      data: { id: "m1", nickname: "Alex" },
      error: null,
    });

    const res = await POST(makeReq({ bandId: "b1" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mockSetBandCookie).toHaveBeenCalledWith("b1");
  });
});
