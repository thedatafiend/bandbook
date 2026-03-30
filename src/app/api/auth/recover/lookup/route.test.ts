import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test-utils/supabase-mock";

const { client: mockClient, query: mockQuery } = createMockSupabase();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

import { POST } from "./route";

describe("POST /api/auth/recover/lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockQuery)) {
      (mockQuery as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockQuery);
    }
  });

  it("returns 400 when email is missing", async () => {
    const req = new Request("http://localhost/api/auth/recover/lookup", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Email is required");
  });

  it("returns 400 when email is empty", async () => {
    const req = new Request("http://localhost/api/auth/recover/lookup", {
      method: "POST",
      body: JSON.stringify({ email: "  " }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it("returns matching bands for the email", async () => {
    mockQuery.ilike.mockReturnValue(
      Promise.resolve({
        data: [
          {
            id: "m1",
            nickname: "Alex",
            band_id: "b1",
            bands: { id: "b1", name: "The Rockers" },
          },
        ],
      })
    );

    const req = new Request("http://localhost/api/auth/recover/lookup", {
      method: "POST",
      body: JSON.stringify({ email: "alex@test.com" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(req);
    const data = await response.json();
    expect(data.bands).toHaveLength(1);
    expect(data.bands[0]).toEqual({
      member_id: "m1",
      band_id: "b1",
      band_name: "The Rockers",
      nickname: "Alex",
    });
  });

  it("returns empty array when no matches found", async () => {
    mockQuery.ilike.mockReturnValue(Promise.resolve({ data: null }));

    const req = new Request("http://localhost/api/auth/recover/lookup", {
      method: "POST",
      body: JSON.stringify({ email: "nobody@test.com" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(req);
    const data = await response.json();
    expect(data.bands).toEqual([]);
  });
});
