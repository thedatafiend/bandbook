import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCookieStore = {
  getAll: vi.fn(() => [{ name: "test", value: "val" }]),
  set: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

const mockCreateServerClient = vi.fn(() => ({ from: vi.fn() }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

import { createClient } from "./server";

describe("supabase server client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  it("creates a server client with correct URL and key", async () => {
    await createClient();

    expect(mockCreateServerClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-anon-key",
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      })
    );
  });

  it("getAll returns cookies from the store", async () => {
    await createClient();

    const cookiesArg = mockCreateServerClient.mock.calls[0][2] as {
      cookies: { getAll: () => Array<{ name: string; value: string }> };
    };
    const result = cookiesArg.cookies.getAll();
    expect(result).toEqual([{ name: "test", value: "val" }]);
  });

  it("setAll sets cookies on the store", async () => {
    await createClient();

    const cookiesArg = mockCreateServerClient.mock.calls[0][2] as {
      cookies: {
        setAll: (
          cookies: Array<{
            name: string;
            value: string;
            options: Record<string, unknown>;
          }>
        ) => void;
      };
    };
    cookiesArg.cookies.setAll([
      { name: "c1", value: "v1", options: { path: "/" } },
    ]);
    expect(mockCookieStore.set).toHaveBeenCalledWith("c1", "v1", { path: "/" });
  });

  it("setAll silently ignores errors (Server Component context)", async () => {
    mockCookieStore.set.mockImplementation(() => {
      throw new Error("Cannot set cookies in Server Component");
    });

    await createClient();

    const cookiesArg = mockCreateServerClient.mock.calls[0][2] as {
      cookies: {
        setAll: (
          cookies: Array<{
            name: string;
            value: string;
            options: Record<string, unknown>;
          }>
        ) => void;
      };
    };
    // Should not throw
    expect(() =>
      cookiesArg.cookies.setAll([
        { name: "c1", value: "v1", options: {} },
      ])
    ).not.toThrow();
  });
});
