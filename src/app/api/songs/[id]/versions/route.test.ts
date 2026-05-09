import { describe, it, expect, vi, beforeEach } from "vitest";

let singleCallCount = 0;
let singleResults: Array<{ data: unknown; error?: unknown }> = [];
let insertSelectSingleResult: { data: unknown; error?: unknown } | null = null;

const mockQuery = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
  in: vi.fn(),
};

function resetChain() {
  singleCallCount = 0;
  for (const key of Object.keys(mockQuery)) {
    (mockQuery as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockQuery);
  }
  const consumeNext = () => {
    const result = singleResults[singleCallCount] ?? { data: null };
    singleCallCount++;
    return Promise.resolve(result);
  };
  mockQuery.single.mockImplementation(consumeNext);
  mockQuery.maybeSingle.mockImplementation(consumeNext);
  mockQuery.insert.mockImplementation(() => ({
    select: () => ({
      single: () => {
        if (insertSelectSingleResult) {
          return Promise.resolve(insertSelectSingleResult);
        }
        const r = singleResults[singleCallCount] ?? { data: null };
        singleCallCount++;
        return Promise.resolve(r);
      },
    }),
  }));
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      from: () => mockQuery,
      storage: { from: () => ({ createSignedUrl: vi.fn() }) },
    })
  ),
}));

vi.mock("@/lib/auth", () => ({
  getAuthContext: vi.fn(),
}));

import { POST } from "./route";
import { getAuthContext } from "@/lib/auth";

const mockGetAuth = vi.mocked(getAuthContext);

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeJsonRequest(body: unknown) {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/songs/[id]/versions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    singleResults = [];
    insertSelectSingleResult = null;
    resetChain();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuth.mockResolvedValue(null);
    const req = makeJsonRequest({ path: "b1/s1/x.mp3" });
    const res = await POST(req, makeParams("s1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when song not found", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [{ data: null, error: new Error("not found") }];

    const req = makeJsonRequest({ path: "b1/s1/x.mp3" });
    const res = await POST(req, makeParams("s1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when path is missing", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [{ data: { id: "s1", band_id: "b1" } }];

    const req = makeJsonRequest({});
    const res = await POST(req, makeParams("s1"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/path/i);
  });

  it("returns 400 when path is not under the band+song prefix", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [{ data: { id: "s1", band_id: "b1" } }];

    // Path scoped to a different band — caller must not be able to register
    // someone else's audio object.
    const req = makeJsonRequest({ path: "other-band/s1/x.mp3" });
    const res = await POST(req, makeParams("s1"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid/i);
  });

  it("registers the first version successfully", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    const version = { id: "v1", version_number: 1 };
    singleResults = [
      { data: { id: "s1", band_id: "b1" } }, // song lookup (single)
      { data: null }, // maybeSingle for version_number — empty (first)
    ];
    insertSelectSingleResult = { data: version, error: null };

    const req = makeJsonRequest({ path: "b1/s1/uuid.mp3", label: "Demo" });
    const res = await POST(req, makeParams("s1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.version).toEqual(version);
  });

  it("returns 500 with the underlying message when version insert fails", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [
      { data: { id: "s1", band_id: "b1" } },
      { data: null },
    ];
    insertSelectSingleResult = { data: null, error: { message: "rls violation" } };

    const req = makeJsonRequest({ path: "b1/s1/uuid.mp3" });
    const res = await POST(req, makeParams("s1"));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain("rls violation");
  });
});
