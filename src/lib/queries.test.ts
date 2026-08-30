import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSongDetail, listSongs, listUserBands } from "./queries";

let singleResult: { data: unknown; error?: unknown } = { data: null };
let orderResults: Array<{ data: unknown; error?: unknown }> = [];
let orderCallCount = 0;
let eqResult: { data: unknown } = { data: [] };
let inResult: { data: unknown } = { data: [] };

const mockQuery: Record<string, ReturnType<typeof vi.fn>> = {
  select: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  in: vi.fn(),
  order: vi.fn(),
  single: vi.fn(),
};

function resetChain() {
  orderCallCount = 0;
  for (const key of Object.keys(mockQuery)) {
    mockQuery[key].mockReturnValue(mockQuery);
  }
  mockQuery.single.mockImplementation(() => Promise.resolve(singleResult));
  mockQuery.order.mockImplementation(() => {
    const result = orderResults[orderCallCount] ?? { data: [] };
    orderCallCount++;
    return Promise.resolve(result);
  });
  mockQuery.in.mockImplementation(() => Promise.resolve(inResult));
}

// Chains ending on .eq() (listUserBands) resolve via a thenable.
Object.defineProperty(mockQuery, "then", {
  enumerable: false,
  writable: true,
  value: (resolve: (value: unknown) => void) => resolve(eqResult),
});

const mockSupabase = {
  from: () => mockQuery,
  storage: {
    from: () => ({
      createSignedUrls: vi.fn(() =>
        Promise.resolve({ data: [{ path: "a.mp3", signedUrl: "https://signed" }] })
      ),
    }),
  },
} as unknown as SupabaseClient;

beforeEach(() => {
  vi.clearAllMocks();
  singleResult = { data: null };
  orderResults = [];
  eqResult = { data: [] };
  inResult = { data: [] };
  resetChain();
});

describe("getSongDetail", () => {
  it("returns null when the song is missing or not in the band", async () => {
    singleResult = { data: null, error: new Error("not found") };
    expect(await getSongDetail(mockSupabase, "s1", "b1")).toBeNull();
  });

  it("throws when the versions query fails instead of rendering zero versions", async () => {
    singleResult = { data: { id: "s1", title: "Song" } };
    orderResults = [
      { data: null, error: new Error("connection reset") }, // versions
      { data: [] }, // lyric sections
    ];

    await expect(getSongDetail(mockSupabase, "s1", "b1")).rejects.toThrow(
      /versions/i
    );
  });

  it("throws when the lyrics query fails", async () => {
    singleResult = { data: { id: "s1", title: "Song" } };
    orderResults = [
      { data: [] }, // versions
      { data: null, error: new Error("connection reset") }, // lyric sections
    ];

    await expect(getSongDetail(mockSupabase, "s1", "b1")).rejects.toThrow(
      /lyrics/i
    );
  });

  it("falls back to 'Unknown' when a joined nickname is missing", async () => {
    singleResult = { data: { id: "s1", title: "Song" } };
    orderResults = [
      {
        data: [
          {
            id: "v1",
            version_number: 1,
            audio_url: "a.mp3",
            created_by_member_id: "m-deleted",
            created_by: null,
          },
        ],
      },
      {
        data: [
          {
            id: "ls1",
            section_type: "verse",
            content: "hi",
            updated_by_member_id: "m-deleted",
            updated_by: null,
          },
          {
            id: "ls2",
            section_type: "chorus",
            content: "yo",
            updated_by_member_id: null,
            updated_by: null,
          },
        ],
      },
    ];

    const song = await getSongDetail(mockSupabase, "s1", "b1");
    expect(song?.versions[0].created_by_nickname).toBe("Unknown");
    expect(song?.versions[0].signed_audio_url).toBe("https://signed");
    expect(song?.lyric_sections[0].updated_by_nickname).toBe("Unknown");
    // No updater recorded → null, not "Unknown"
    expect(song?.lyric_sections[1].updated_by_nickname).toBeNull();
  });
});

describe("listSongs", () => {
  it("returns null on a query error", async () => {
    orderResults = [{ data: null, error: new Error("boom") }];
    expect(await listSongs(mockSupabase, "b1")).toBeNull();
  });

  it("maps aggregate counts", async () => {
    orderResults = [
      {
        data: [
          {
            id: "s1",
            title: "One",
            status: "draft",
            current_version_id: null,
            created_at: "2024-01-01",
            updated_at: "2024-01-02",
            created_by_member_id: "m1",
            versions: [{ count: 3 }],
            lyric_sections: [{ count: 0 }],
          },
        ],
      },
    ];

    const songs = await listSongs(mockSupabase, "b1");
    expect(songs).toEqual([
      expect.objectContaining({ id: "s1", version_count: 3, has_lyrics: false }),
    ]);
  });
});

describe("listUserBands", () => {
  it("labels memberships with a missing band as 'Unknown'", async () => {
    eqResult = {
      data: [
        { id: "m1", band_id: "b1", nickname: "Alex", bands: { id: "b1", name: "Rockers" } },
        { id: "m2", band_id: "b2", nickname: "Al", bands: null },
      ],
    };

    const bands = await listUserBands(mockSupabase, "user_1");
    expect(bands).toEqual([
      { member_id: "m1", band_id: "b1", band_name: "Rockers", nickname: "Alex" },
      { member_id: "m2", band_id: "b2", band_name: "Unknown", nickname: "Al" },
    ]);
  });
});
