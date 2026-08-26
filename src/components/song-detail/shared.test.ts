import { describe, it, expect } from "vitest";
import {
  formatTime,
  formatDate,
  sectionDisplayLabel,
  readError,
} from "./shared";

describe("formatTime", () => {
  it("formats seconds as m:ss", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(59)).toBe("0:59");
    expect(formatTime(61)).toBe("1:01");
    expect(formatTime(600)).toBe("10:00");
  });

  it("handles invalid input", () => {
    expect(formatTime(NaN)).toBe("0:00");
    expect(formatTime(Infinity)).toBe("0:00");
  });
});

describe("formatDate", () => {
  it("formats a date string as short month + day", () => {
    const result = formatDate("2024-06-15T12:00:00Z");
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/15/);
  });
});

describe("sectionDisplayLabel", () => {
  it("prefers the explicit section label", () => {
    expect(
      sectionDisplayLabel({ section_type: "custom", section_label: "Solo" })
    ).toBe("Solo");
  });

  it("capitalizes the section type when no label is set", () => {
    expect(
      sectionDisplayLabel({ section_type: "verse", section_label: null })
    ).toBe("Verse");
  });
});

describe("readError", () => {
  it("returns the JSON error field when present", async () => {
    const res = new Response(JSON.stringify({ error: "Nope" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
    expect(await readError(res, "Fallback")).toBe("Nope");
  });

  it("falls back to status + body snippet for non-JSON responses", async () => {
    const res = new Response("gateway blew up", { status: 502 });
    expect(await readError(res, "Upload failed")).toBe(
      "Upload failed (HTTP 502): gateway blew up"
    );
  });
});
