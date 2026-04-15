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
  default: { compare: vi.fn() },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

import { POST } from "./route";
import { auth } from "@clerk/nextjs/server";
import bcrypt from "bcryptjs";

const mockAuth = vi.mocked(auth);
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
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);
    const res = await POST(makeReq({ inviteToken: "tok", passcode: "1234", nickname: "A" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when invite token is missing", async () => {
    const res = await POST(makeReq({ passcode: "1234", nickname: "A" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when passcode is missing", async () => {
    const res = await POST(makeReq({ inviteToken: "tok", nickname: "A" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when nickname is missing", async () => {
    const res = await POST(makeReq({ inviteToken: "tok", passcode: "1234" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when band not found", async () => {
    mockQuery.single.mockResolvedValueOnce({ data: null, error: new Error("not found") });
    const res = await POST(makeReq({ inviteToken: "tok", passcode: "1234", nickname: "A" }));
    expect(res.status).toBe(404);
  });

  it("returns 401 when passcode is wrong", async () => {
    mockQuery.single.mockResolvedValueOnce({ data: { id: "b1", passcode_hash: "hash" }, error: null });
    mockCompare.mockResolvedValue(false as never);

    const res = await POST(makeReq({ inviteToken: "tok", passcode: "wrong", nickname: "A" }));
    expect(res.status).toBe(401);
  });

  it("joins band successfully", async () => {
    const band = { id: "b1", name: "Band", passcode_hash: "hash" };
    const member = { id: "m1", nickname: "Alex", clerk_user_id: "user_123" };

    mockQuery.single
      .mockResolvedValueOnce({ data: band, error: null })
      .mockResolvedValueOnce({ data: member, error: null });
    mockCompare.mockResolvedValue(true as never);

    const res = await POST(makeReq({ inviteToken: "tok", passcode: "1234", nickname: "Alex" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.band).toEqual({ id: "b1", name: "Band" });
    expect(data.member).toEqual({ id: "m1", nickname: "Alex" });
  });

  it("sets joiner as member role", async () => {
    const band = { id: "b1", name: "Band", passcode_hash: "hash" };
    const member = { id: "m1", nickname: "Alex", clerk_user_id: "user_123" };

    mockQuery.single
      .mockResolvedValueOnce({ data: band, error: null })
      .mockResolvedValueOnce({ data: member, error: null });
    mockCompare.mockResolvedValue(true as never);

    await POST(makeReq({ inviteToken: "tok", passcode: "1234", nickname: "Alex" }));

    expect(mockQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ role: "member", clerk_user_id: "user_123" })
    );
  });
});
