import { describe, it, expect, vi, beforeEach } from "vitest";

let singleCallCount = 0;
let singleResults: Array<{ data: unknown; error?: unknown }> = [];
let insertSelectResults: Array<{ data: unknown; error?: unknown }> = [];
let insertSelectCount = 0;

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
  insertSelectCount = 0;
  for (const key of Object.keys(mockQuery)) {
    (mockQuery as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockQuery);
  }
  mockQuery.single.mockImplementation(() => {
    const result = singleResults[singleCallCount] ?? { data: null };
    singleCallCount++;
    return Promise.resolve(result);
  });
  mockQuery.insert.mockImplementation(() => {
    const selectResult = insertSelectResults[insertSelectCount] ?? { data: null };
    insertSelectCount++;
    return {
      select: () => ({
        // Allow both thenable (await insert().select()) and .single()
        then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
          Promise.resolve(selectResult).then(resolve, reject),
        single: () => {
          const r = singleResults[singleCallCount] ?? { data: null };
          singleCallCount++;
          return Promise.resolve(r);
        },
      }),
    };
  });
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve({ from: () => mockQuery })),
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

function makeReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/songs/s1/lyrics", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/songs/[id]/lyrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    singleResults = [];
    insertSelectResults = [];
    resetChain();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuth.mockResolvedValue(null);
    const res = await POST(makeReq({ sections: [] }), makeParams("s1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when song not found", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [{ data: null, error: new Error("not found") }];

    const res = await POST(makeReq({ sections: [] }), makeParams("s1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when sections is not an array", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [{ data: { id: "s1", band_id: "b1" } }];

    const res = await POST(makeReq({ sections: "not-array" }), makeParams("s1"));
    expect(res.status).toBe(400);
  });

  it("saves lyrics with empty sections", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    // Song lookup, then revision insert
    singleResults = [
      { data: { id: "s1", band_id: "b1" } },
      { data: { id: "rev1", created_at: "2024-01-01" } },
    ];
    // No lyric_sections insert (0 rows)
    insertSelectResults = [
      { data: { id: "rev1", created_at: "2024-01-01" } },
    ];

    const res = await POST(makeReq({ sections: [] }), makeParams("s1"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.sections).toEqual([]);
  });

  it("saves lyrics with sections", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    const savedSections = [
      { id: "ls1", section_type: "verse", section_label: null, content: "Hello", sort_order: 0 },
    ];
    singleResults = [
      { data: { id: "s1", band_id: "b1" } },
      { data: { id: "rev1", created_at: "2024-01-01" } },
    ];
    insertSelectResults = [
      { data: savedSections, error: null }, // lyric_sections insert
      { data: null }, // lyric_revisions insert (uses .single())
    ];

    const sections = [
      { section_type: "verse", content: "Hello", sort_order: 0 },
    ];
    const res = await POST(makeReq({ sections }), makeParams("s1"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.sections).toEqual(savedSections);
    expect(data.revision_id).toBe("rev1");
  });
});
