import { describe, it, expect, vi, beforeEach } from "vitest";

let songLookup: { data: unknown; error?: unknown } = { data: null };
let signedUrlResult: { data: { signedUrl: string; token: string; path: string } | null; error?: unknown } = {
  data: { signedUrl: "https://example.test/signed", token: "tok", path: "stub-path" },
};

const fromMock = vi.fn(() => ({
  select: () => ({
    eq: () => ({
      eq: () => ({
        single: () => Promise.resolve(songLookup),
      }),
    }),
  }),
}));

const createSignedUploadUrl = vi.fn(() => Promise.resolve(signedUrlResult));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      from: fromMock,
      storage: { from: () => ({ createSignedUploadUrl }) },
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

describe("POST /api/songs/[id]/versions/upload-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    songLookup = { data: { id: "s1" } };
    signedUrlResult = {
      data: { signedUrl: "https://example.test/signed", token: "tok", path: "b1/s1/uuid.mp3" },
    };
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuth.mockResolvedValue(null);
    const res = await POST(makeJsonRequest({ filename: "x.mp3" }), makeParams("s1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when song does not belong to the band", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    songLookup = { data: null };
    const res = await POST(makeJsonRequest({ filename: "x.mp3" }), makeParams("s1"));
    expect(res.status).toBe(404);
  });

  it("returns a signed URL scoped to the caller's band+song", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    const res = await POST(makeJsonRequest({ filename: "Mas Por Favor.m4a" }), makeParams("s1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.signedUrl).toBe("https://example.test/signed");
    expect(body.token).toBe("tok");
    expect(body.path).toBe("b1/s1/uuid.mp3");

    // The path requested from Supabase must start with the caller's band + song
    // — that's the prefix the register endpoint validates against.
    const calledPath = createSignedUploadUrl.mock.calls[0][0] as string;
    expect(calledPath.startsWith("b1/s1/")).toBe(true);
    expect(calledPath.endsWith(".m4a")).toBe(true);
  });

  it("returns 500 when Supabase fails to create the signed URL", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    signedUrlResult = { data: null, error: { message: "bucket not found" } };
    const res = await POST(makeJsonRequest({ filename: "x.mp3" }), makeParams("s1"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("bucket not found");
  });
});
