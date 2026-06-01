import { describe, it, expect, beforeEach } from "vitest";
import { createMockSupabase } from "@/test-utils/supabase-mock";
import { generateShareToken, getSharedRecording } from "./shares";

describe("generateShareToken", () => {
  it("produces a non-empty, URL-safe token", () => {
    const token = generateShareToken();
    expect(token.length).toBeGreaterThan(0);
    // base64url => only A-Z a-z 0-9 - _ (no +, /, or =)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces unique tokens", () => {
    const a = generateShareToken();
    const b = generateShareToken();
    expect(a).not.toBe(b);
  });
});

describe("getSharedRecording", () => {
  const { client, query } = createMockSupabase();

  beforeEach(() => {
    for (const key of Object.keys(query)) {
      (query as Record<string, ReturnType<typeof import("vitest").vi.fn>>)[
        key
      ].mockReturnValue(query);
    }
  });

  it("returns null for an empty token", async () => {
    const result = await getSharedRecording(client as never, "");
    expect(result).toBeNull();
  });

  it("returns null when the share is missing or revoked", async () => {
    query.single.mockResolvedValueOnce({ data: null });
    const result = await getSharedRecording(client as never, "tok");
    expect(result).toBeNull();
  });

  it("returns null when the version has no audio", async () => {
    query.single
      .mockResolvedValueOnce({ data: { version_id: "v1", revoked_at: null } })
      .mockResolvedValueOnce({ data: { audio_url: null, song_id: "s1" } });
    const result = await getSharedRecording(client as never, "tok");
    expect(result).toBeNull();
  });

  it("returns the recording details and a signed url on success", async () => {
    query.single
      .mockResolvedValueOnce({ data: { version_id: "v1", revoked_at: null } })
      .mockResolvedValueOnce({
        data: {
          audio_url: "band/song/take.mp3",
          audio_duration: 123,
          label: "Take 1",
          version_number: 2,
          song_id: "s1",
        },
      })
      .mockResolvedValueOnce({ data: { title: "My Song" } });

    const result = await getSharedRecording(client as never, "tok");

    expect(result).toEqual({
      title: "My Song",
      versionNumber: 2,
      label: "Take 1",
      durationSeconds: 123,
      signedAudioUrl: "https://signed.url",
    });
  });
});
