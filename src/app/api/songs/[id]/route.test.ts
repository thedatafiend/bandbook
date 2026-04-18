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
  in: vi.fn(),
  order: vi.fn(),
  single: vi.fn(),
};

let orderResults: Array<{ data: unknown }> = [];
let orderCallCount = 0;
let inResult: { data: unknown } = { data: [] };
let createSignedUrlsResult: { data: unknown } = { data: [] };

function resetChain() {
  singleCallCount = 0;
  orderCallCount = 0;
  for (const key of Object.keys(mockQuery)) {
    (mockQuery as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockQuery);
  }
  mockQuery.single.mockImplementation(() => {
    const result = singleResults[singleCallCount] ?? { data: null };
    singleCallCount++;
    return Promise.resolve(result);
  });
  mockQuery.order.mockImplementation(() => {
    const result = orderResults[orderCallCount] ?? { data: [] };
    orderCallCount++;
    return Promise.resolve(result);
  });
  mockQuery.in.mockImplementation(() => Promise.resolve(inResult));
  mockQuery.update.mockImplementation(() => ({
    eq: vi.fn(() => updateResult),
  }));
}

const mockStorageFrom = vi.fn(() => ({
  createSignedUrls: vi.fn(() => Promise.resolve(createSignedUrlsResult)),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      from: () => mockQuery,
      storage: { from: mockStorageFrom },
    })
  ),
}));

vi.mock("@/lib/auth", () => ({
  getAuthContext: vi.fn(),
}));

import { GET, PATCH } from "./route";
import { getAuthContext } from "@/lib/auth";

const mockGetAuth = vi.mocked(getAuthContext);

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/songs/s1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/songs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    singleResults = [];
    orderResults = [];
    inResult = { data: [] };
    createSignedUrlsResult = { data: [] };
    updateResult = { error: null };
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
    singleResults = [{ data: null, error: new Error("not found") }];

    const res = await GET(new Request("http://localhost"), makeParams("s1"));
    expect(res.status).toBe(404);
  });

  it("returns song with versions and lyric sections", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });

    const song = { id: "s1", title: "Test Song", band_id: "b1" };
    const versions = [{ id: "v1", version_number: 1, audio_url: "path.mp3", created_by_member_id: "m1" }];
    const sections = [{ id: "ls1", section_type: "verse", content: "La la la", updated_by_member_id: "m1" }];

    // Promise.all resolves: [songResult, versionsResult, lyricsResult]
    singleResults = [{ data: song, error: null }];
    orderResults = [
      { data: versions },
      { data: sections },
    ];
    inResult = { data: [{ id: "m1", nickname: "Alex" }] };
    createSignedUrlsResult = {
      data: [{ path: "path.mp3", signedUrl: "https://signed.url" }],
    };

    const res = await GET(new Request("http://localhost"), makeParams("s1"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.song.id).toBe("s1");
    expect(data.song.versions).toHaveLength(1);
    expect(data.song.versions[0].signed_audio_url).toBe("https://signed.url");
    expect(data.song.versions[0].created_by_nickname).toBe("Alex");
    expect(data.song.lyric_sections).toHaveLength(1);
  });
});

describe("PATCH /api/songs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    singleResults = [];
    orderResults = [];
    updateResult = { error: null };
    resetChain();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuth.mockResolvedValue(null);
    const res = await PATCH(makeReq({ title: "New" }), makeParams("s1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when song not found", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [{ data: null }];

    const res = await PATCH(makeReq({ title: "New" }), makeParams("s1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when title is empty", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [{ data: { id: "s1" } }];

    const res = await PATCH(makeReq({ title: "  " }), makeParams("s1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when no updates provided", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [{ data: { id: "s1" } }];

    const res = await PATCH(makeReq({}), makeParams("s1"));
    expect(res.status).toBe(400);
  });

  it("updates title successfully", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [{ data: { id: "s1" } }];

    const res = await PATCH(makeReq({ title: "Updated Title" }), makeParams("s1"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("returns 500 on update error", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [{ data: { id: "s1" } }];
    updateResult = { error: new Error("db error") };

    const res = await PATCH(makeReq({ title: "Fail" }), makeParams("s1"));
    expect(res.status).toBe(500);
  });

  it("updates bpm successfully", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [{ data: { id: "s1" } }];

    const res = await PATCH(makeReq({ bpm: 120 }), makeParams("s1"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("clears bpm when null is provided", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [{ data: { id: "s1" } }];

    const res = await PATCH(makeReq({ bpm: null }), makeParams("s1"));
    expect(res.status).toBe(200);
  });

  it("returns 400 when bpm is not an integer", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [{ data: { id: "s1" } }];

    const res = await PATCH(makeReq({ bpm: 120.5 }), makeParams("s1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when bpm is below range", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [{ data: { id: "s1" } }];

    const res = await PATCH(makeReq({ bpm: 0 }), makeParams("s1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when bpm is above range", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [{ data: { id: "s1" } }];

    const res = await PATCH(makeReq({ bpm: 1000 }), makeParams("s1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when bpm is not a number", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [{ data: { id: "s1" } }];

    const res = await PATCH(makeReq({ bpm: "120" }), makeParams("s1"));
    expect(res.status).toBe(400);
  });

  it("updates both title and bpm together", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [{ data: { id: "s1" } }];

    const res = await PATCH(
      makeReq({ title: "New Title", bpm: 140 }),
      makeParams("s1")
    );
    expect(res.status).toBe(200);
  });
});
