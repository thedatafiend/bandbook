import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test-utils/supabase-mock";

const { client: mockClient, query: mockQuery } = createMockSupabase();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

vi.mock("@/lib/auth", () => ({
  getAuthContext: vi.fn(),
}));

import { GET } from "./route";
import { getAuthContext } from "@/lib/auth";

const mockGetAuth = vi.mocked(getAuthContext);

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/songs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockQuery)) {
      (mockQuery as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockQuery);
    }
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
    mockQuery.single.mockResolvedValueOnce({ data: null, error: new Error("not found") });

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
    const members = [{ id: "m1", nickname: "Alex" }];

    mockQuery.single.mockResolvedValueOnce({ data: song, error: null });
    mockQuery.order
      .mockResolvedValueOnce({ data: versions })
      .mockResolvedValueOnce({ data: sections });
    mockQuery.in.mockResolvedValueOnce({ data: members });

    // Mock storage signed URL
    mockClient.storage.from = vi.fn(() => ({
      upload: vi.fn(),
      createSignedUrl: vi.fn(() => Promise.resolve({ data: { signedUrl: "https://signed.url" } })),
    }));

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
