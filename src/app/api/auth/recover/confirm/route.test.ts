import { describe, it, expect, vi, beforeEach } from "vitest";

let singleCallCount = 0;
let singleResults: Array<{ data: unknown; error?: unknown }> = [];
let updateResult: { error: unknown } = { error: null };

const mockQuery = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
};

function resetChain() {
  singleCallCount = 0;
  mockQuery.select.mockReturnValue(mockQuery);
  mockQuery.insert.mockReturnValue(mockQuery);
  mockQuery.delete.mockReturnValue(mockQuery);
  mockQuery.eq.mockReturnValue(mockQuery);
  mockQuery.update.mockImplementation(() => {
    // After update().eq().eq() chain, return the update result
    const chain = {
      eq: vi.fn(() => ({
        // The code does .update({...}).eq("id", member.id) and expects { error }
        error: updateResult.error,
      })),
    };
    return chain;
  });
  mockQuery.single.mockImplementation(() => {
    const result = singleResults[singleCallCount] ?? { data: null };
    singleCallCount++;
    return Promise.resolve(result);
  });
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve({ from: () => mockQuery })),
}));

vi.mock("@/lib/session", () => ({
  setSessionCookies: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn() },
}));

import { POST } from "./route";
import bcrypt from "bcryptjs";
import { setSessionCookies } from "@/lib/session";

const mockCompare = vi.mocked(bcrypt.compare);
const mockSetCookies = vi.mocked(setSessionCookies);

function makeReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/auth/recover/confirm", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/auth/recover/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    singleResults = [];
    updateResult = { error: null };
    resetChain();
  });

  it("returns 400 when memberId is missing", async () => {
    const res = await POST(makeReq({ passcode: "1234" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when passcode is missing", async () => {
    const res = await POST(makeReq({ memberId: "m1" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when member not found", async () => {
    singleResults = [{ data: null }];
    const res = await POST(makeReq({ memberId: "m1", passcode: "1234" }));
    expect(res.status).toBe(404);
  });

  it("returns 404 when band not found", async () => {
    singleResults = [
      { data: { id: "m1", band_id: "b1" } },
      { data: null },
    ];
    const res = await POST(makeReq({ memberId: "m1", passcode: "1234" }));
    expect(res.status).toBe(404);
  });

  it("returns 401 when passcode is incorrect", async () => {
    singleResults = [
      { data: { id: "m1", band_id: "b1" } },
      { data: { id: "b1", passcode_hash: "hash" } },
    ];
    mockCompare.mockResolvedValue(false as never);

    const res = await POST(makeReq({ memberId: "m1", passcode: "wrong" }));
    expect(res.status).toBe(401);
  });

  it("returns 500 when session update fails", async () => {
    singleResults = [
      { data: { id: "m1", band_id: "b1" } },
      { data: { id: "b1", passcode_hash: "hash" } },
    ];
    mockCompare.mockResolvedValue(true as never);
    updateResult = { error: new Error("db error") };

    const res = await POST(makeReq({ memberId: "m1", passcode: "1234" }));
    expect(res.status).toBe(500);
  });

  it("recovers session successfully", async () => {
    const member = { id: "m1", band_id: "b1", nickname: "Alex" };
    const band = { id: "b1", name: "The Band", passcode_hash: "hash" };
    singleResults = [{ data: member }, { data: band }];
    mockCompare.mockResolvedValue(true as never);
    updateResult = { error: null };

    const res = await POST(makeReq({ memberId: "m1", passcode: "1234" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.band).toEqual({ id: "b1", name: "The Band" });
    expect(data.member).toEqual({ id: "m1", nickname: "Alex" });
    expect(mockSetCookies).toHaveBeenCalled();
  });
});
