import { describe, it, expect } from "vitest";
import {
  fft,
  pitchClassOf,
  chromagram,
  scoreKeys,
  estimateKey,
  FRAME_SIZE,
} from "./key-detection";

const SR = 22050;

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Render chords (arrays of MIDI notes) as sums of harmonic-rich tones, one
 * chord after another, so the analyzer sees overtones like a real recording.
 */
function renderChords(chords: number[][], secondsPerChord = 1): Float32Array {
  const perChord = Math.floor(SR * secondsPerChord);
  const out = new Float32Array(perChord * chords.length);
  chords.forEach((chord, c) => {
    for (const note of chord) {
      const f0 = midiToFreq(note);
      for (let h = 1; h <= 4; h++) {
        const amp = 0.15 / h;
        const w = (2 * Math.PI * f0 * h) / SR;
        for (let i = 0; i < perChord; i++) out[c * perChord + i] += amp * Math.sin(w * i);
      }
    }
  });
  return out;
}

// MIDI note numbers, middle C = 60
const C4 = 60;
const triad = (root: number, minor = false) => [root, root + (minor ? 3 : 4), root + 7];

describe("fft", () => {
  it("puts a pure cosine's energy in its bin", () => {
    const n = 64;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = Math.cos((2 * Math.PI * 5 * i) / n);
    fft(re, im);
    const mags = Array.from(re, (r, i) => Math.hypot(r, im[i]));
    expect(mags[5]).toBeCloseTo(n / 2, 6);
    expect(mags[n - 5]).toBeCloseTo(n / 2, 6);
    expect(mags[4]).toBeCloseTo(0, 6);
  });

  it("rejects non-power-of-two lengths", () => {
    expect(() => fft(new Float64Array(6), new Float64Array(6))).toThrow();
  });
});

describe("pitchClassOf", () => {
  it("maps frequencies to the nearest pitch class", () => {
    expect(pitchClassOf(440)).toBe(9); // A
    expect(pitchClassOf(261.63)).toBe(0); // C
    expect(pitchClassOf(55)).toBe(9);
    expect(pitchClassOf(277.18)).toBe(1); // C♯
  });
});

describe("chromagram", () => {
  it("returns null for silence", () => {
    expect(chromagram(new Float32Array(FRAME_SIZE * 3), SR)).toBeNull();
  });

  it("concentrates a single note in its pitch class", () => {
    const chroma = chromagram(renderChords([[69]], 2), SR)!;
    const max = chroma.indexOf(Math.max(...chroma));
    expect(max).toBe(9);
  });

  it("analyzes signals shorter than one frame", () => {
    const chroma = chromagram(renderChords([[C4]], 0.1), SR);
    expect(chroma).not.toBeNull();
  });
});

describe("scoreKeys", () => {
  it("returns all 24 keys sorted best first", () => {
    const scores = scoreKeys([1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1]);
    expect(scores).toHaveLength(24);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1].score).toBeGreaterThanOrEqual(scores[i].score);
    }
  });

  it("ranks C major first for a weighted C major profile", () => {
    const [best] = scoreKeys([5, 0, 2, 0, 4, 2, 0, 4, 0, 2, 0, 1]);
    expect(best).toMatchObject({ tonic: 0, mode: "major" });
  });
});

describe("estimateKey", () => {
  it("returns null for silence", () => {
    expect(estimateKey(new Float32Array(SR * 2), SR)).toBeNull();
  });

  it("detects C major from a I–IV–V–I progression", () => {
    const audio = renderChords([triad(C4), triad(C4 + 5), triad(C4 + 7), triad(C4)]);
    expect(estimateKey(audio, SR)).toMatchObject({ tonic: 0, mode: "major" });
  });

  it("detects A minor from an i–iv–V–i progression", () => {
    const A3 = 57;
    const audio = renderChords([
      triad(A3, true),
      triad(A3 + 5, true),
      triad(A3 + 7),
      triad(A3, true),
    ]);
    expect(estimateKey(audio, SR)).toMatchObject({ tonic: 9, mode: "minor" });
  });

  it("follows a transposition (E♭ major)", () => {
    const Eb4 = 63;
    const audio = renderChords([triad(Eb4), triad(Eb4 + 5), triad(Eb4 + 7), triad(Eb4)]);
    expect(estimateKey(audio, SR)).toMatchObject({ tonic: 3, mode: "major" });
  });

  it("reports a confidence between 0 and 1", () => {
    const audio = renderChords([triad(C4), triad(C4 + 7), triad(C4)]);
    const result = estimateKey(audio, SR)!;
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
