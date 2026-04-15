import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCookieStore = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  getAll: vi.fn(() => []),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

import { setBandCookie, getBandCookie, clearBandCookie } from "./session";

describe("session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("setBandCookie", () => {
    it("sets bb_band cookie", async () => {
      await setBandCookie("band-456");

      expect(mockCookieStore.set).toHaveBeenCalledTimes(1);
      expect(mockCookieStore.set).toHaveBeenCalledWith("bb_band", "band-456", {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    });

    it("sets secure flag in production", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      await setBandCookie("band");

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "bb_band",
        "band",
        expect.objectContaining({ secure: true })
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("getBandCookie", () => {
    it("returns band ID when cookie exists", async () => {
      mockCookieStore.get.mockImplementation((name: string) => {
        if (name === "bb_band") return { value: "band-xyz" };
        return undefined;
      });

      const result = await getBandCookie();
      expect(result).toBe("band-xyz");
    });

    it("returns null when cookie is missing", async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const result = await getBandCookie();
      expect(result).toBeNull();
    });
  });

  describe("clearBandCookie", () => {
    it("deletes bb_band cookie", async () => {
      await clearBandCookie();

      expect(mockCookieStore.delete).toHaveBeenCalledWith("bb_band");
    });
  });
});
