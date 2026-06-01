import { describe, it, expect, vi, beforeEach } from "vitest";

const mockClient = {};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

vi.mock("@/lib/shares", () => ({
  getSharedRecording: vi.fn(),
}));

import { GET } from "./route";
import { getSharedRecording } from "@/lib/shares";

const mockGet = vi.mocked(getSharedRecording);
const params = (token: string) => ({ params: Promise.resolve({ token }) });

describe("GET /api/share/[token]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when the token resolves to nothing", async () => {
    mockGet.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/share/x"), params("x"));
    expect(res.status).toBe(404);
  });

  it("returns the recording when the token is valid", async () => {
    mockGet.mockResolvedValue({
      title: "My Song",
      versionNumber: 1,
      label: null,
      durationSeconds: 60,
      signedAudioUrl: "https://signed.url",
    });
    const res = await GET(new Request("http://localhost/api/share/tok"), params("tok"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.recording.title).toBe("My Song");
    expect(data.recording.signedAudioUrl).toBe("https://signed.url");
  });
});
