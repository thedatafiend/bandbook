import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test-utils/supabase-mock";

const { client: mockClient, query: mockQuery } = createMockSupabase();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

vi.mock("@/lib/session", () => ({
  setBandCookie: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn(() => Promise.resolve("hashed")) },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

import { POST } from "./route";
import { auth } from "@clerk/nextjs/server";

const mockAuth = vi.mocked(auth);

function makeReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/bands/create", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/bands/create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockQuery)) {
      (mockQuery as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockQuery);
    }
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);
    const res = await POST(makeReq({ bandName: "Band", passcode: "1234", nickname: "Alex" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when band name is missing", async () => {
    const res = await POST(makeReq({ passcode: "1234", nickname: "Alex" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Band name is required");
  });

  it("returns 400 when passcode is too short", async () => {
    const res = await POST(makeReq({ bandName: "Band", passcode: "12", nickname: "Alex" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("4–8 characters");
  });

  it("returns 400 when passcode is too long", async () => {
    const res = await POST(makeReq({ bandName: "Band", passcode: "123456789", nickname: "Alex" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when nickname is missing", async () => {
    const res = await POST(makeReq({ bandName: "Band", passcode: "1234" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Nickname is required");
  });

  it("returns 500 when band insert fails", async () => {
    mockQuery.single.mockResolvedValueOnce({ data: null, error: new Error("fail") });

    const res = await POST(makeReq({ bandName: "Band", passcode: "1234", nickname: "Alex" }));
    expect(res.status).toBe(500);
  });

  it("creates band and member successfully", async () => {
    const band = { id: "b1", name: "Band", invite_token: "tok" };
    const member = { id: "m1", nickname: "Alex", clerk_user_id: "user_123" };

    mockQuery.single
      .mockResolvedValueOnce({ data: band, error: null })
      .mockResolvedValueOnce({ data: member, error: null });

    const res = await POST(makeReq({ bandName: "Band", passcode: "1234", nickname: "Alex" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.band).toEqual({ id: "b1", name: "Band", invite_token: "tok" });
    expect(data.member).toEqual({ id: "m1", nickname: "Alex" });
  });

  it("sets creator as admin role", async () => {
    const band = { id: "b1", name: "Band", invite_token: "tok" };
    const member = { id: "m1", nickname: "Alex", clerk_user_id: "user_123" };

    mockQuery.single
      .mockResolvedValueOnce({ data: band, error: null })
      .mockResolvedValueOnce({ data: member, error: null });

    await POST(makeReq({ bandName: "Band", passcode: "1234", nickname: "Alex" }));

    expect(mockQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ role: "admin", clerk_user_id: "user_123" })
    );
  });
});
