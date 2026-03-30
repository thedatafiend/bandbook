import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test-utils/supabase-mock";

const { client: mockClient, query: mockQuery } = createMockSupabase();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

vi.mock("@/lib/auth", () => ({
  getAuthContext: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(() => Promise.resolve("newhash")),
  },
}));

import { POST } from "./route";
import { getAuthContext } from "@/lib/auth";
import bcrypt from "bcryptjs";

const mockGetAuth = vi.mocked(getAuthContext);
const mockCompare = vi.mocked(bcrypt.compare);

function makeReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/bands/change-passcode", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/bands/change-passcode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockQuery)) {
      (mockQuery as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockQuery);
    }
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuth.mockResolvedValue(null);
    const res = await POST(makeReq({ currentPasscode: "1234", newPasscode: "5678" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when current passcode is missing", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1", passcode_hash: "hash" } as never,
    });
    const res = await POST(makeReq({ newPasscode: "5678" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when new passcode is too short", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1", passcode_hash: "hash" } as never,
    });
    const res = await POST(makeReq({ currentPasscode: "1234", newPasscode: "12" }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when current passcode is wrong", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1", passcode_hash: "hash" } as never,
    });
    mockCompare.mockResolvedValue(false as never);
    const res = await POST(makeReq({ currentPasscode: "wrong", newPasscode: "5678" }));
    expect(res.status).toBe(401);
  });

  it("changes passcode successfully", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1", passcode_hash: "hash" } as never,
    });
    mockCompare.mockResolvedValue(true as never);
    mockQuery.eq.mockReturnValue({ error: null });

    const res = await POST(makeReq({ currentPasscode: "1234", newPasscode: "5678" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
