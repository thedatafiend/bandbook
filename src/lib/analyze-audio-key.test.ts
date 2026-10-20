import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  analyzeKeyFromArrayBuffer,
  analyzeKeyFromFile,
  analyzeKeyFromUrl,
  canAnalyzeKey,
  downmix,
  ANALYSIS_SAMPLE_RATE,
  MAX_ANALYSIS_BYTES,
} from "./analyze-audio-key";

const SR = ANALYSIS_SAMPLE_RATE;

/** Minimal AudioBuffer stand-in (jsdom has no Web Audio). */
function fakeBuffer(channels: Float32Array[], sampleRate = SR): AudioBuffer {
  return {
    length: channels[0].length,
    numberOfChannels: channels.length,
    sampleRate,
    duration: channels[0].length / sampleRate,
    getChannelData: (c: number) => channels[c],
  } as unknown as AudioBuffer;
}

/** A C major triad with a few harmonics, `seconds` long. */
function cMajorTriad(seconds = 2): Float32Array {
  const out = new Float32Array(SR * seconds);
  for (const midi of [60, 64, 67]) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    for (let h = 1; h <= 3; h++) {
      for (let i = 0; i < out.length; i++) out[i] += (0.1 / h) * Math.sin((2 * Math.PI * f * h * i) / SR);
    }
  }
  return out;
}

let decodeAudioData: ReturnType<typeof vi.fn>;
let ctorArgs: unknown[] = [];

function installOfflineContext() {
  decodeAudioData = vi.fn();
  class FakeOfflineAudioContext {
    constructor(...args: unknown[]) {
      ctorArgs = args;
    }
    decodeAudioData = decodeAudioData;
  }
  (window as unknown as Record<string, unknown>).OfflineAudioContext = FakeOfflineAudioContext;
}

describe("analyze-audio-key", () => {
  beforeEach(() => {
    installOfflineContext();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).OfflineAudioContext;
    vi.restoreAllMocks();
  });

  describe("canAnalyzeKey", () => {
    it("is true when OfflineAudioContext exists", () => {
      expect(canAnalyzeKey()).toBe(true);
    });

    it("is false without Web Audio", () => {
      delete (window as unknown as Record<string, unknown>).OfflineAudioContext;
      expect(canAnalyzeKey()).toBe(false);
    });
  });

  describe("downmix", () => {
    it("averages channels and truncates", () => {
      const left = new Float32Array([1, 1, 1, 1]);
      const right = new Float32Array([0, 0, 0, 0]);
      expect(Array.from(downmix(fakeBuffer([left, right]), 3))).toEqual([0.5, 0.5, 0.5]);
    });
  });

  describe("analyzeKeyFromArrayBuffer", () => {
    it("decodes at the analysis sample rate and detects the key", async () => {
      const triad = cMajorTriad();
      decodeAudioData.mockResolvedValue(fakeBuffer([triad, triad]));
      const result = await analyzeKeyFromArrayBuffer(new ArrayBuffer(8));
      expect(ctorArgs).toEqual([1, 1, SR]);
      expect(result).toMatchObject({ tonic: 0, mode: "major" });
    });

    it("returns null when decoding fails", async () => {
      decodeAudioData.mockRejectedValue(new Error("EncodingError"));
      expect(await analyzeKeyFromArrayBuffer(new ArrayBuffer(8))).toBeNull();
    });

    it("returns null for empty input without decoding", async () => {
      expect(await analyzeKeyFromArrayBuffer(new ArrayBuffer(0))).toBeNull();
      expect(decodeAudioData).not.toHaveBeenCalled();
    });

    it("returns null when Web Audio is unavailable", async () => {
      delete (window as unknown as Record<string, unknown>).OfflineAudioContext;
      expect(await analyzeKeyFromArrayBuffer(new ArrayBuffer(8))).toBeNull();
    });
  });

  describe("analyzeKeyFromFile", () => {
    it("skips files over the size cap without reading them", async () => {
      const file = { size: MAX_ANALYSIS_BYTES + 1, arrayBuffer: vi.fn() } as unknown as Blob;
      expect(await analyzeKeyFromFile(file)).toBeNull();
      expect(file.arrayBuffer).not.toHaveBeenCalled();
    });

    it("analyzes a small file", async () => {
      decodeAudioData.mockResolvedValue(fakeBuffer([cMajorTriad()]));
      const file = { size: 8, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) } as unknown as Blob;
      expect(await analyzeKeyFromFile(file)).toMatchObject({ tonic: 0, mode: "major" });
    });
  });

  describe("analyzeKeyFromUrl", () => {
    it("fetches and analyzes the recording", async () => {
      decodeAudioData.mockResolvedValue(fakeBuffer([cMajorTriad()]));
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-length": "8" }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });
      expect(await analyzeKeyFromUrl("https://signed.url/a.mp3")).toMatchObject({
        tonic: 0,
        mode: "major",
      });
      expect(global.fetch).toHaveBeenCalledWith("https://signed.url/a.mp3");
    });

    it("returns null when the download fails", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, headers: new Headers() });
      expect(await analyzeKeyFromUrl("https://signed.url/a.mp3")).toBeNull();
    });

    it("skips recordings over the size cap", async () => {
      const arrayBuffer = vi.fn();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-length": String(MAX_ANALYSIS_BYTES + 1) }),
        arrayBuffer,
      });
      expect(await analyzeKeyFromUrl("https://signed.url/a.wav")).toBeNull();
      expect(arrayBuffer).not.toHaveBeenCalled();
    });

    it("returns null on network errors", async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
      expect(await analyzeKeyFromUrl("https://signed.url/a.mp3")).toBeNull();
    });
  });
});
