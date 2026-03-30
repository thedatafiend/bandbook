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

import { setSessionCookies, getSessionCookies, clearSessionCookies } from "./session";

describe("session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("setSessionCookies", () => {
    it("sets bb_session and bb_band cookies", async () => {
      await setSessionCookies("token-123", "band-456");

      expect(mockCookieStore.set).toHaveBeenCalledTimes(2);
      expect(mockCookieStore.set).toHaveBeenCalledWith("bb_session", "token-123", {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
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

      await setSessionCookies("tok", "band");

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "bb_session",
        "tok",
        expect.objectContaining({ secure: true })
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("getSessionCookies", () => {
    it("returns session token and band ID when cookies exist", async () => {
      mockCookieStore.get.mockImplementation((name: string) => {
        if (name === "bb_session") return { value: "tok-abc" };
        if (name === "bb_band") return { value: "band-xyz" };
        return undefined;
      });

      const result = await getSessionCookies();
      expect(result).toEqual({ sessionToken: "tok-abc", bandId: "band-xyz" });
    });

    it("returns nulls when cookies are missing", async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const result = await getSessionCookies();
      expect(result).toEqual({ sessionToken: null, bandId: null });
    });
  });

  describe("clearSessionCookies", () => {
    it("deletes both cookies", async () => {
      await clearSessionCookies();

      expect(mockCookieStore.delete).toHaveBeenCalledWith("bb_session");
      expect(mockCookieStore.delete).toHaveBeenCalledWith("bb_band");
    });
  });
});
