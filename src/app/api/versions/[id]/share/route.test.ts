import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test-utils/supabase-mock";

const { client: mockClient, query: mockQuery } = createMockSupabase();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

vi.mock("@/lib/auth", () => ({
  getAuthContext: vi.fn(),
}));

import { POST, DELETE } from "./route";
import { getAuthContext } from "@/lib/auth";

const mockGetAuth = vi.mocked(getAuthContext);

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => new Request("http://localhost/api/versions/v1/share", { method: "POST" });

function resetQuery() {
  for (const key of Object.keys(mockQuery)) {
    (mockQuery as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockQuery);
  }
}

function authed() {
  mockGetAuth.mockResolvedValue({
    member: { id: "m1" } as never,
    band: { id: "b1" } as never,
    userId: "u1",
  } as never);
}

describe("POST /api/versions/[id]/share", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetQuery();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuth.mockResolvedValue(null);
    const res = await POST(req(), params("v1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when the version is not in the band", async () => {
    authed();
    // version lookup ok, but song ownership check fails
    mockQuery.single
      .mockResolvedValueOnce({ data: { id: "v1", song_id: "s1" } })
      .mockResolvedValueOnce({ data: null });
    const res = await POST(req(), params("v1"));
    expect(res.status).toBe(404);
  });

  it("reuses the existing active link", async () => {
    authed();
    mockQuery.single
      .mockResolvedValueOnce({ data: { id: "v1", song_id: "s1" } }) // version
      .mockResolvedValueOnce({ data: { id: "s1" } }) // song owned by band
      .mockResolvedValueOnce({ data: { token: "existing-token" } }); // existing share
    const res = await POST(req(), params("v1"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.share.token).toBe("existing-token");
    expect(data.share.url).toContain("/share/existing-token");
    expect(mockQuery.insert).not.toHaveBeenCalled();
  });

  it("creates a new link when none exists", async () => {
    authed();
    mockQuery.single
      .mockResolvedValueOnce({ data: { id: "v1", song_id: "s1" } }) // version
      .mockResolvedValueOnce({ data: { id: "s1" } }) // song owned by band
      .mockResolvedValueOnce({ data: null }) // no existing share
      .mockResolvedValueOnce({ data: { token: "fresh-token" }, error: null }); // insert
    const res = await POST(req(), params("v1"));
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.share.token).toBe("fresh-token");
    expect(mockQuery.insert).toHaveBeenCalled();
  });
});

describe("DELETE /api/versions/[id]/share", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetQuery();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuth.mockResolvedValue(null);
    const res = await DELETE(req(), params("v1"));
    expect(res.status).toBe(401);
  });

  it("revokes the active link", async () => {
    authed();
    mockQuery.single
      .mockResolvedValueOnce({ data: { id: "v1", song_id: "s1" } }) // version
      .mockResolvedValueOnce({ data: { id: "s1" } }); // song owned by band
    // terminal update chain ends on .is()
    mockQuery.is.mockResolvedValueOnce({ error: null });
    const res = await DELETE(req(), params("v1"));
    expect(res.status).toBe(200);
    expect(mockQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ revoked_at: expect.any(String) })
    );
  });
});
