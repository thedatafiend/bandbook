import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test-utils/supabase-mock";

const { client: mockClient, query: mockQuery } = createMockSupabase();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

import { GET } from "./route";

function makeReq() {
  return new Request("http://localhost/api/bands/invite/tok");
}

function makeParams(token = "tok") {
  return { params: Promise.resolve({ token }) };
}

describe("GET /api/bands/invite/[token]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockQuery)) {
      (mockQuery as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockQuery);
    }
  });

  it("returns 404 when the token matches no band", async () => {
    mockQuery.single.mockResolvedValueOnce({ data: null, error: new Error("not found") });

    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns band id and name for a valid token", async () => {
    mockQuery.single.mockResolvedValueOnce({
      data: { id: "b1", name: "The Midnight Ramblers" },
      error: null,
    });

    const res = await GET(makeReq(), makeParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.band).toEqual({ id: "b1", name: "The Midnight Ramblers" });
  });

  it("looks the band up by invite token", async () => {
    mockQuery.single.mockResolvedValueOnce({ data: { id: "b1", name: "Band" }, error: null });

    await GET(makeReq(), makeParams("tok-123"));

    expect(mockClient.from).toHaveBeenCalledWith("bands");
    expect(mockQuery.eq).toHaveBeenCalledWith("invite_token", "tok-123");
  });

  it("does not expose the passcode hash or invite token", async () => {
    mockQuery.single.mockResolvedValueOnce({ data: { id: "b1", name: "Band" }, error: null });

    await GET(makeReq(), makeParams());

    expect(mockQuery.select).toHaveBeenCalledWith("id, name");
  });
});
