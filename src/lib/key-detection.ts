import type { DetectedKey, KeyMode } from "@/lib/music-key";

/**
 * Musical key estimation from raw mono PCM samples.
 *
 * 1. Split the signal into Hann-windowed frames and FFT each one.
 * 2. Fold the spectrum into a 12-bin chromagram (energy per pitch class).
 * 3. Correlate the chromagram against the Krumhansl–Kessler major/minor key
 *    profiles rotated to all 12 tonics; the best Pearson correlation wins.
 *
 * This is the classic Krumhansl–Schmuckler approach. On full band mixes it
 * typically gets the exact key right ~60–75% of the time, and most misses
 * are to a closely related key (relative major/minor, or a fifth away), so
 * callers should treat the result as a suggestion, never an overwrite.
 *
 * Pure and DOM-free so it is unit-testable; decoding audio files lives in
 * analyze-audio-key.ts.
 */

// Krumhansl & Kessler (1982) probe-tone ratings, index 0 = tonic.
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/** FFT frame length. ~0.37 s at 22.05 kHz: ~2.7 Hz bins, fine enough to
 * separate semitones down to ~A1. */
export const FRAME_SIZE = 8192;

// Below A1 the bins are too coarse to resolve semitones; above ~C8 there is
// little pitched content, mostly cymbals and noise.
const MIN_FREQ = 55;
const MAX_FREQ = 4200;

/** Frames quieter than this RMS are treated as silence and skipped. */
const SILENCE_RMS = 1e-4;

/** In-place iterative radix-2 FFT. Length must be a power of two. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n !== im.length || (n & (n - 1)) !== 0) {
    throw new Error("FFT length must be a power of two and arrays must match");
  }

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = (-2 * Math.PI) / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const wr = Math.cos(step * k);
        const wi = Math.sin(step * k);
        const a = start + k;
        const b = a + half;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

/** Pitch class (0 = C) of a frequency, rounded to the nearest semitone. */
export function pitchClassOf(freq: number): number {
  const midi = Math.round(69 + 12 * Math.log2(freq / 440));
  return ((midi % 12) + 12) % 12;
}

/**
 * 12-bin pitch-class profile of the whole signal. Each non-silent frame is
 * normalized before summing so loud passages don't dominate quiet ones.
 * Returns null when the signal has no audible frames.
 */
export function chromagram(samples: Float32Array, sampleRate: number): Float64Array | null {
  const n = FRAME_SIZE;
  const window = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  }

  // Precompute which FFT bins fall in range and their pitch classes.
  const binPitchClass = new Int8Array(n / 2).fill(-1);
  for (let bin = 1; bin < n / 2; bin++) {
    const freq = (bin * sampleRate) / n;
    if (freq >= MIN_FREQ && freq <= MAX_FREQ) binPitchClass[bin] = pitchClassOf(freq);
  }

  const total = new Float64Array(12);
  const frameChroma = new Float64Array(12);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  let usedFrames = 0;

  // A signal shorter than one frame is analyzed as a single zero-padded frame.
  const frameCount = Math.max(1, Math.floor(samples.length / n));
  for (let f = 0; f < frameCount; f++) {
    const offset = f * n;
    let energy = 0;
    for (let i = 0; i < n; i++) {
      const s = samples[offset + i] ?? 0;
      energy += s * s;
      re[i] = s * window[i];
      im[i] = 0;
    }
    if (Math.sqrt(energy / n) < SILENCE_RMS) continue;

    fft(re, im);

    frameChroma.fill(0);
    let frameSum = 0;
    for (let bin = 1; bin < n / 2; bin++) {
      const pc = binPitchClass[bin];
      if (pc < 0) continue;
      const mag = Math.hypot(re[bin], im[bin]);
      frameChroma[pc] += mag;
      frameSum += mag;
    }
    if (frameSum === 0) continue;
    for (let pc = 0; pc < 12; pc++) total[pc] += frameChroma[pc] / frameSum;
    usedFrames++;
  }

  return usedFrames > 0 ? total : null;
}

function pearson(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const len = a.length;
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < len; i++) {
    meanA += a[i];
    meanB += b[i];
  }
  meanA /= len;
  meanB /= len;
  let num = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < len; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    varA += da * da;
    varB += db * db;
  }
  const denom = Math.sqrt(varA * varB);
  return denom === 0 ? 0 : num / denom;
}

export interface KeyScore {
  tonic: number;
  mode: KeyMode;
  score: number;
}

/** Correlation of a chromagram with all 24 key profiles, best first. */
export function scoreKeys(chroma: ArrayLike<number>): KeyScore[] {
  const scores: KeyScore[] = [];
  const rotated = new Float64Array(12);
  for (const [mode, profile] of [
    ["major", MAJOR_PROFILE],
    ["minor", MINOR_PROFILE],
  ] as const) {
    for (let tonic = 0; tonic < 12; tonic++) {
      for (let pc = 0; pc < 12; pc++) rotated[pc] = profile[(pc - tonic + 12) % 12];
      scores.push({ tonic, mode, score: pearson(chroma, rotated) });
    }
  }
  return scores.sort((x, y) => y.score - x.score);
}

/**
 * Estimate the key of a mono signal. Returns null for silence or audio with
 * no pitch-class preference (e.g. pure noise). `confidence` is the winning
 * correlation clamped to 0–1.
 */
export function estimateKey(samples: Float32Array, sampleRate: number): DetectedKey | null {
  const chroma = chromagram(samples, sampleRate);
  if (!chroma) return null;
  const [best] = scoreKeys(chroma);
  if (!best || best.score <= 0) return null;
  return {
    tonic: best.tonic,
    mode: best.mode,
    confidence: Math.min(1, Math.round(best.score * 100) / 100),
  };
}
