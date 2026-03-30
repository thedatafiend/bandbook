import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test-utils/supabase-mock";

const { client: mockClient, query: mockQuery } = createMockSupabase();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

vi.mock("@/lib/session", () => ({
  setSessionCookies: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn(() => Promise.resolve("hashed")) },
}));

import { POST } from "./route";

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
  });

  it("returns 400 when band name is missing", async () => {
    const res = await POST(makeReq({ passcode: "1234", nickname: "Alex", email: "a@b.com" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Band name is required");
  });

  it("returns 400 when passcode is too short", async () => {
    const res = await POST(makeReq({ bandName: "Band", passcode: "12", nickname: "Alex", email: "a@b.com" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("4–8 characters");
  });

  it("returns 400 when passcode is too long", async () => {
    const res = await POST(makeReq({ bandName: "Band", passcode: "123456789", nickname: "Alex", email: "a@b.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when nickname is missing", async () => {
    const res = await POST(makeReq({ bandName: "Band", passcode: "1234", email: "a@b.com" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Nickname is required");
  });

  it("returns 400 when email is invalid", async () => {
    const res = await POST(makeReq({ bandName: "Band", passcode: "1234", nickname: "Alex", email: "invalid" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("A valid email is required");
  });

  it("returns 500 when band insert fails", async () => {
    mockQuery.single.mockResolvedValueOnce({ data: null, error: new Error("fail") });

    const res = await POST(makeReq({ bandName: "Band", passcode: "1234", nickname: "Alex", email: "a@b.com" }));
    expect(res.status).toBe(500);
  });

  it("creates band and member successfully", async () => {
    const band = { id: "b1", name: "Band", invite_token: "tok" };
    const member = { id: "m1", nickname: "Alex", session_token: "stok" };

    mockQuery.single
      .mockResolvedValueOnce({ data: band, error: null })
      .mockResolvedValueOnce({ data: member, error: null });

    const res = await POST(makeReq({ bandName: "Band", passcode: "1234", nickname: "Alex", email: "a@b.com" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.band).toEqual({ id: "b1", name: "Band", invite_token: "tok" });
    expect(data.member).toEqual({ id: "m1", nickname: "Alex" });
  });
});
