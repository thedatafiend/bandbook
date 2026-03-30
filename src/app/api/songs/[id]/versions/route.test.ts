import { describe, it, expect, vi, beforeEach } from "vitest";

let singleCallCount = 0;
let singleResults: Array<{ data: unknown; error?: unknown }> = [];
let mockUploadFn = vi.fn(() => Promise.resolve({ error: null }));
let insertSelectSingleResult: { data: unknown; error?: unknown } | null = null;

const mockQuery = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  single: vi.fn(),
  in: vi.fn(),
};

function resetChain() {
  singleCallCount = 0;
  for (const key of Object.keys(mockQuery)) {
    (mockQuery as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockQuery);
  }
  mockQuery.single.mockImplementation(() => {
    const result = singleResults[singleCallCount] ?? { data: null };
    singleCallCount++;
    return Promise.resolve(result);
  });
  mockQuery.insert.mockImplementation(() => ({
    select: () => ({
      single: () => {
        if (insertSelectSingleResult) {
          return Promise.resolve(insertSelectSingleResult);
        }
        const r = singleResults[singleCallCount] ?? { data: null };
        singleCallCount++;
        return Promise.resolve(r);
      },
    }),
  }));
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      from: () => mockQuery,
      storage: { from: () => ({ upload: (...args: unknown[]) => mockUploadFn(...args), createSignedUrl: vi.fn() }) },
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

function makeRequestWithFormData(fields: Record<string, unknown>) {
  // Create a request with a mocked formData() to avoid issues with File size preservation
  const file = fields.file as File | undefined;
  const req = new Request("http://localhost", { method: "POST" });

  // Override formData to return controlled results
  const mockFormData = {
    get: (name: string) => {
      if (name === "file") return file ?? null;
      return (fields[name] as string) ?? null;
    },
  };
  vi.spyOn(req, "formData").mockResolvedValue(mockFormData as unknown as FormData);

  return req;
}

describe("POST /api/songs/[id]/versions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    singleResults = [];
    insertSelectSingleResult = null;
    mockUploadFn = vi.fn(() => Promise.resolve({ error: null }));
    resetChain();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuth.mockResolvedValue(null);
    const req = makeRequestWithFormData({ file: new File(["audio"], "test.mp3") });
    const res = await POST(req, makeParams("s1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when song not found", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [{ data: null, error: new Error("not found") }];

    const req = makeRequestWithFormData({ file: new File(["audio"], "test.mp3") });
    const res = await POST(req, makeParams("s1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when no file provided", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [{ data: { id: "s1", band_id: "b1" } }];

    const req = makeRequestWithFormData({});
    const res = await POST(req, makeParams("s1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when file is too large", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [{ data: { id: "s1", band_id: "b1" } }];

    const bigFile = new File(["x"], "big.mp3");
    Object.defineProperty(bigFile, "size", { value: 600 * 1024 * 1024 });
    const req = makeRequestWithFormData({ file: bigFile });
    const res = await POST(req, makeParams("s1"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("500 MB");
  });

  it("uploads first version successfully", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    const version = { id: "v1", version_number: 1 };
    singleResults = [
      { data: { id: "s1", band_id: "b1" } },
      { data: null },
    ];
    insertSelectSingleResult = { data: version, error: null };

    const file = new File(["audio data"], "test.mp3", { type: "audio/mpeg" });
    const req = makeRequestWithFormData({ file, label: "Demo" });
    const res = await POST(req, makeParams("s1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.version).toEqual(version);
    expect(mockUploadFn).toHaveBeenCalled();
  });

  it("returns 500 when upload fails", async () => {
    mockGetAuth.mockResolvedValue({
      member: { id: "m1" } as never,
      band: { id: "b1" } as never,
    });
    singleResults = [
      { data: { id: "s1", band_id: "b1" } },
      { data: null },
    ];
    mockUploadFn = vi.fn(() => Promise.resolve({ error: { message: "storage full" } }));

    const file = new File(["audio"], "test.mp3");
    const req = makeRequestWithFormData({ file });
    const res = await POST(req, makeParams("s1"));
    expect(res.status).toBe(500);
  });
});
