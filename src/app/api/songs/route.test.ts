import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test-utils/supabase-mock";

const { client: mockClient, query: mockQuery } = createMockSupabase();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

vi.mock("@/lib/auth", () => ({
  getAuthContext: vi.fn(),
}));

import { GET, POST } from "./route";
import { getAuthContext } from "@/lib/auth";

const mockGetAuth = vi.mocked(getAuthContext);

describe("GET /api/songs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockQuery)) {
      (mockQuery as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockQuery);
    }
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 500 on database error", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    mockQuery.order.mockResolvedValue({ data: null, error: new Error("fail") });

    const res = await GET();
    expect(res.status).toBe(500);
  });

  it("returns empty songs list", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1", nickname: "Alex" } as never,
      band: { id: "b1", name: "The Band", invite_token: "inv" } as never,
    });
    mockQuery.order.mockResolvedValue({ data: [], error: null });

    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.songs).toEqual([]);
  });

  it("returns songs with version counts and lyrics info from aggregated query", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1", nickname: "Alex" } as never,
      band: { id: "b1", name: "The Band", invite_token: "inv" } as never,
    });
    const songs = [
      {
        id: "s1",
        title: "Song 1",
        status: "draft",
        current_version_id: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        created_by_member_id: "m1",
        versions: [{ count: 2 }],
        lyric_sections: [{ count: 3 }],
      },
      {
        id: "s2",
        title: "Song 2",
        status: "draft",
        current_version_id: null,
        created_at: "2024-01-02",
        updated_at: "2024-01-02",
        created_by_member_id: "m1",
        versions: [{ count: 0 }],
        lyric_sections: [{ count: 0 }],
      },
    ];
    mockQuery.order.mockResolvedValueOnce({ data: songs, error: null });

    const res = await GET();
    const data = await res.json();
    expect(data.songs[0].version_count).toBe(2);
    expect(data.songs[0].has_lyrics).toBe(true);
    expect(data.songs[1].version_count).toBe(0);
    expect(data.songs[1].has_lyrics).toBe(false);
    // Counts come from the single aggregated select — no follow-up queries.
    expect(mockQuery.in).not.toHaveBeenCalled();
  });

  it("includes the caller's member and band context", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1", nickname: "Alex" } as never,
      band: { id: "b1", name: "The Band", invite_token: "inv" } as never,
    });
    mockQuery.order.mockResolvedValue({ data: [], error: null });

    const res = await GET();
    const data = await res.json();
    expect(data.member).toEqual({ nickname: "Alex" });
    expect(data.band).toEqual({ name: "The Band", invite_token: "inv" });
  });
});

describe("POST /api/songs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockQuery)) {
      (mockQuery as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockQuery);
    }
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuth.mockResolvedValue(null);
    const req = new Request("http://localhost/api/songs", {
      method: "POST",
      body: JSON.stringify({ title: "Test" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when title is missing", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    const req = new Request("http://localhost/api/songs", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates a song successfully", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    const song = { id: "s1", title: "New Song", band_id: "b1" };
    mockQuery.single.mockResolvedValueOnce({ data: song, error: null });

    const req = new Request("http://localhost/api/songs", {
      method: "POST",
      body: JSON.stringify({ title: "New Song" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.song).toEqual(song);
  });
});
