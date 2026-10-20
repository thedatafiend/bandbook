import { describe, it, expect } from "vitest";
import {
  formatKey,
  keyId,
  parseKeyId,
  keysEqual,
  ALL_KEYS,
  keyFromColumns,
  parseKeyInput,
  parseDetectedKeyInput,
} from "./music-key";

describe("formatKey", () => {
  it("uses conventional spellings per mode", () => {
    expect(formatKey({ tonic: 0, mode: "major" })).toBe("C major");
    expect(formatKey({ tonic: 3, mode: "major" })).toBe("E♭ major");
    expect(formatKey({ tonic: 6, mode: "major" })).toBe("F♯ major");
    expect(formatKey({ tonic: 1, mode: "minor" })).toBe("C♯ minor");
    expect(formatKey({ tonic: 8, mode: "minor" })).toBe("G♯ minor");
    expect(formatKey({ tonic: 10, mode: "minor" })).toBe("B♭ minor");
  });
});

describe("keyId / parseKeyId", () => {
  it("round-trips every key", () => {
    for (const key of ALL_KEYS) {
      expect(parseKeyId(keyId(key))).toEqual(key);
    }
  });

  it("rejects malformed ids", () => {
    expect(parseKeyId("")).toBeNull();
    expect(parseKeyId("12:major")).toBeNull();
    expect(parseKeyId("3:dorian")).toBeNull();
    expect(parseKeyId("x:minor")).toBeNull();
  });
});

describe("ALL_KEYS", () => {
  it("contains 24 distinct keys", () => {
    expect(ALL_KEYS).toHaveLength(24);
    expect(new Set(ALL_KEYS.map(keyId)).size).toBe(24);
  });
});

describe("keysEqual", () => {
  it("compares tonic and mode, treating null as no key", () => {
    expect(keysEqual({ tonic: 9, mode: "minor" }, { tonic: 9, mode: "minor" })).toBe(true);
    expect(keysEqual({ tonic: 9, mode: "minor" }, { tonic: 0, mode: "major" })).toBe(false);
    expect(keysEqual(null, null)).toBe(true);
    expect(keysEqual(null, { tonic: 0, mode: "major" })).toBe(false);
  });
});

describe("keyFromColumns", () => {
  it("builds a key only when both columns are valid", () => {
    expect(keyFromColumns(2, "minor")).toEqual({ tonic: 2, mode: "minor" });
    expect(keyFromColumns(null, "minor")).toBeNull();
    expect(keyFromColumns(2, null)).toBeNull();
    expect(keyFromColumns(13, "major")).toBeNull();
    expect(keyFromColumns(2, "lydian")).toBeNull();
  });
});

describe("parseKeyInput", () => {
  it("accepts null to clear", () => {
    expect(parseKeyInput(null)).toEqual({ ok: true, value: null });
  });

  it("accepts a valid key", () => {
    expect(parseKeyInput({ tonic: 7, mode: "major" })).toEqual({
      ok: true,
      value: { tonic: 7, mode: "major" },
    });
  });

  it.each([
    "C major",
    [7, "major"],
    { tonic: -1, mode: "major" },
    { tonic: 12, mode: "major" },
    { tonic: 1.5, mode: "major" },
    { tonic: "1", mode: "major" },
    { tonic: 1, mode: "Major" },
    { tonic: 1 },
  ])("rejects %j", (input) => {
    expect(parseKeyInput(input).ok).toBe(false);
  });
});

describe("parseDetectedKeyInput", () => {
  it("accepts a key with confidence", () => {
    expect(parseDetectedKeyInput({ tonic: 9, mode: "minor", confidence: 0.8 })).toEqual({
      ok: true,
      value: { tonic: 9, mode: "minor", confidence: 0.8 },
    });
  });

  it("drops unknown fields", () => {
    const result = parseDetectedKeyInput({ tonic: 9, mode: "minor", confidence: 0.8, x: 1 });
    expect(result).toEqual({ ok: true, value: { tonic: 9, mode: "minor", confidence: 0.8 } });
  });

  it("accepts null to clear", () => {
    expect(parseDetectedKeyInput(null)).toEqual({ ok: true, value: null });
  });

  it.each([undefined, 1.2, -0.1, Number.NaN, "0.5"])("rejects confidence %s", (confidence) => {
    expect(parseDetectedKeyInput({ tonic: 9, mode: "minor", confidence }).ok).toBe(false);
  });

  it("rejects an invalid key", () => {
    expect(parseDetectedKeyInput({ tonic: 99, mode: "minor", confidence: 0.5 }).ok).toBe(false);
  });
});
