import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test-utils/supabase-mock";

const { client: mockClient, query: mockQuery } = createMockSupabase();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

vi.mock("@/lib/auth", () => ({
  getAuthContext: vi.fn(),
}));

import { PUT } from "./route";
import { getAuthContext } from "@/lib/auth";

const mockGetAuth = vi.mocked(getAuthContext);

function makeReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/members/email", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("PUT /api/members/email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockQuery)) {
      (mockQuery as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockQuery);
    }
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuth.mockResolvedValue(null);
    const res = await PUT(makeReq({ email: "a@b.com" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when email is invalid", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    const res = await PUT(makeReq({ email: "invalid" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is empty", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    const res = await PUT(makeReq({ email: "" }));
    expect(res.status).toBe(400);
  });

  it("updates email successfully", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    mockQuery.eq.mockReturnValue({ error: null });

    const res = await PUT(makeReq({ email: "New@Test.COM" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.email).toBe("new@test.com");
  });

  it("returns 500 on database error", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    mockQuery.eq.mockReturnValue({ error: new Error("fail") });

    const res = await PUT(makeReq({ email: "a@b.com" }));
    expect(res.status).toBe(500);
  });
});
