import { describe, it, expect, vi, beforeEach } from "vitest";

let singleCallCount = 0;
let singleResults: Array<{ data: unknown }> = [];
let insertSelectResults: Array<{ data: unknown }> = [];
let insertSelectCount = 0;

const mockQuery = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
  in: vi.fn(),
  order: vi.fn(),
  single: vi.fn(),
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

import { GET, POST } from "./route";
import { getAuthContext } from "@/lib/auth";

const mockGetAuth = vi.mocked(getAuthContext);

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/songs/[id]/lyrics/revisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    singleResults = [];
    insertSelectResults = [];
    resetChain();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuth.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), makeParams("s1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when song not found", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [{ data: null }];

    const res = await GET(new Request("http://localhost"), makeParams("s1"));
    expect(res.status).toBe(404);
  });

  it("returns revisions with nicknames", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [{ data: { id: "s1" } }];
    mockQuery.order.mockResolvedValueOnce({
      data: [{ id: "r1", created_by_member_id: "m1", snapshot: {}, created_at: "2024-01-01", revision_note: null }],
    });
    mockQuery.in.mockResolvedValueOnce({ data: [{ id: "m1", nickname: "Alex" }] });

    const res = await GET(new Request("http://localhost"), makeParams("s1"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.revisions[0].created_by_nickname).toBe("Alex");
  });

  it("returns empty revisions when none exist", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [{ data: { id: "s1" } }];
    mockQuery.order.mockResolvedValueOnce({ data: [] });

    const res = await GET(new Request("http://localhost"), makeParams("s1"));
    const data = await res.json();
    expect(data.revisions).toEqual([]);
  });
});

describe("POST /api/songs/[id]/lyrics/revisions (restore)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    singleResults = [];
    insertSelectResults = [];
    resetChain();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuth.mockResolvedValue(null);
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ revisionId: "r1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeParams("s1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when revisionId is missing", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [{ data: { id: "s1" } }];

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeParams("s1"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when revision not found", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [
      { data: { id: "s1" } },
      { data: null },
    ];

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ revisionId: "r1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeParams("s1"));
    expect(res.status).toBe(404);
  });

  it("restores a revision successfully", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    const snapshot = {
      sections: [{ section_type: "verse", section_label: null, content: "Old lyrics", sort_order: 0 }],
    };
    const savedSections = [{ id: "ls1", section_type: "verse", content: "Old lyrics" }];

    singleResults = [
      { data: { id: "s1" } },        // song lookup
      { data: { snapshot } },          // revision lookup
      { data: { id: "rev-new", created_at: "2024-01-02" } }, // new revision single
    ];
    insertSelectResults = [
      { data: savedSections },  // lyric_sections insert
      { data: null },           // lyric_revisions insert (uses .single())
    ];

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ revisionId: "r1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeParams("s1"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.sections).toEqual(savedSections);
    expect(data.revision_id).toBe("rev-new");
  });
});
