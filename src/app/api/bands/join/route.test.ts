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
  default: { compare: vi.fn() },
}));

import { POST } from "./route";
import bcrypt from "bcryptjs";

const mockCompare = vi.mocked(bcrypt.compare);

function makeReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/bands/join", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/bands/join", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockQuery)) {
      (mockQuery as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockQuery);
    }
  });

  it("returns 400 when invite token is missing", async () => {
    const res = await POST(makeReq({ passcode: "1234", nickname: "A", email: "a@b.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when passcode is missing", async () => {
    const res = await POST(makeReq({ inviteToken: "tok", nickname: "A", email: "a@b.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when nickname is missing", async () => {
    const res = await POST(makeReq({ inviteToken: "tok", passcode: "1234", email: "a@b.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is invalid", async () => {
    const res = await POST(makeReq({ inviteToken: "tok", passcode: "1234", nickname: "A", email: "bad" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when band not found", async () => {
    mockQuery.single.mockResolvedValueOnce({ data: null, error: new Error("not found") });
    const res = await POST(makeReq({ inviteToken: "tok", passcode: "1234", nickname: "A", email: "a@b.com" }));
    expect(res.status).toBe(404);
  });

  it("returns 401 when passcode is wrong", async () => {
    mockQuery.single.mockResolvedValueOnce({ data: { id: "b1", passcode_hash: "hash" }, error: null });
    mockCompare.mockResolvedValue(false as never);

    const res = await POST(makeReq({ inviteToken: "tok", passcode: "wrong", nickname: "A", email: "a@b.com" }));
    expect(res.status).toBe(401);
  });

  it("joins band successfully", async () => {
    const band = { id: "b1", name: "Band", passcode_hash: "hash" };
    const member = { id: "m1", nickname: "Alex", session_token: "stok" };

    mockQuery.single
      .mockResolvedValueOnce({ data: band, error: null })
      .mockResolvedValueOnce({ data: member, error: null });
    mockCompare.mockResolvedValue(true as never);

    const res = await POST(makeReq({ inviteToken: "tok", passcode: "1234", nickname: "Alex", email: "a@b.com" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.band).toEqual({ id: "b1", name: "Band" });
    expect(data.member).toEqual({ id: "m1", nickname: "Alex" });
  });
});
