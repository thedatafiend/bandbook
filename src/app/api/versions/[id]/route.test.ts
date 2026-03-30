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
  order: vi.fn(),
};

function resetChain() {
  singleCallCount = 0;
  for (const key of Object.keys(mockQuery)) {
    (mockQuery as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockQuery);
  }
  mockQuery.single.mockImplementation(() => {
    const result = singleResults[singleCallCount] ?? { data: null };
    singleCallCount++;
    return Promise.resolve(result);
  });
  mockQuery.update.mockImplementation(() => ({
    eq: vi.fn(() => updateResult),
  }));
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve({ from: () => mockQuery })),
}));

vi.mock("@/lib/auth", () => ({
  getAuthContext: vi.fn(),
}));

import { PATCH } from "./route";
import { getAuthContext } from "@/lib/auth";

const mockGetAuth = vi.mocked(getAuthContext);

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/versions/v1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("PATCH /api/versions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    singleResults = [];
    updateResult = { error: null };
    resetChain();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuth.mockResolvedValue(null);
    const res = await PATCH(makeReq({ label: "Demo" }), makeParams("v1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when version not found (both queries fail)", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [
      { data: null, error: new Error("not found") }, // join query
      { data: null },                                 // fallback version query
    ];

    const res = await PATCH(makeReq({ label: "Demo" }), makeParams("v1"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when song doesn't belong to band (fallback path)", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [
      { data: null, error: new Error("join fail") }, // join query fails
      { data: { id: "v1", song_id: "s1" } },         // fallback finds version
      { data: null },                                  // song not in band
    ];

    const res = await PATCH(makeReq({ label: "Demo" }), makeParams("v1"));
    expect(res.status).toBe(404);
  });

  it("updates label successfully via join path", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [
      { data: { id: "v1", song_id: "s1", songs: { band_id: "b1" } }, error: null },
    ];

    const res = await PATCH(makeReq({ label: "Final Mix" }), makeParams("v1"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("updates notes successfully", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [
      { data: { id: "v1", song_id: "s1", songs: { band_id: "b1" } }, error: null },
    ];

    const res = await PATCH(makeReq({ notes: "Added guitar solo" }), makeParams("v1"));
    expect(res.status).toBe(200);
  });

  it("sets version as current", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [
      { data: { id: "v1", song_id: "s1", songs: { band_id: "b1" } }, error: null },
      { data: { song_id: "s1" } }, // ver query for setCurrent
    ];

    const res = await PATCH(makeReq({ setCurrent: true }), makeParams("v1"));
    expect(res.status).toBe(200);
  });

  it("returns 500 on update error", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [
      { data: { id: "v1", song_id: "s1", songs: { band_id: "b1" } }, error: null },
    ];
    updateResult = { error: new Error("db error") };

    const res = await PATCH(makeReq({ label: "Fail" }), makeParams("v1"));
    expect(res.status).toBe(500);
  });

  it("returns success with no updates when body is empty", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [
      { data: { id: "v1", song_id: "s1", songs: { band_id: "b1" } }, error: null },
    ];

    const res = await PATCH(makeReq({}), makeParams("v1"));
    expect(res.status).toBe(200);
  });
});
