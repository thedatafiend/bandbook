import { estimateKey } from "@/lib/key-detection";
import type { DetectedKey } from "@/lib/music-key";

/**
 * Browser-side glue: decode an audio file with the Web Audio API and run key
 * detection on it. Everything happens on the user's device — audio never
 * passes through our servers (see the signed-URL upload flow).
 */

/**
 * Decoding resamples to this rate. Pitched content we care about tops out
 * around 4 kHz, and decoding at a low rate cuts memory ~2× vs. 44.1 kHz.
 * 22.05 kHz is the lowest rate every browser's OfflineAudioContext accepts.
 */
export const ANALYSIS_SAMPLE_RATE = 22050;

/**
 * decodeAudioData has to hold the whole decoded file in memory, so very
 * large uploads (long WAVs) are skipped rather than risk crashing a phone tab.
 */
export const MAX_ANALYSIS_BYTES = 100 * 1024 * 1024;

/** Only the first 10 minutes are analyzed. */
export const MAX_ANALYSIS_SECONDS = 600;

type OfflineCtxCtor = new (channels: number, length: number, sampleRate: number) => {
  decodeAudioData(data: ArrayBuffer): Promise<AudioBuffer>;
};

function getOfflineContextCtor(): OfflineCtxCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    OfflineAudioContext?: OfflineCtxCtor;
    webkitOfflineAudioContext?: OfflineCtxCtor;
  };
  return w.OfflineAudioContext ?? w.webkitOfflineAudioContext ?? null;
}

/** Whether this browser can run key analysis at all. */
export function canAnalyzeKey(): boolean {
  return getOfflineContextCtor() !== null;
}

/** Average all channels into one, truncated to `maxSamples`. */
export function downmix(buffer: AudioBuffer, maxSamples: number): Float32Array {
  const length = Math.min(buffer.length, maxSamples);
  const out = new Float32Array(length);
  const channels = buffer.numberOfChannels;
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) out[i] += data[i] / channels;
  }
  return out;
}

/**
 * Detect the key of encoded audio bytes (mp3, m4a, wav…). Resolves null when
 * the browser can't decode it or the audio has no clear key; never throws.
 */
export async function analyzeKeyFromArrayBuffer(data: ArrayBuffer): Promise<DetectedKey | null> {
  const Ctor = getOfflineContextCtor();
  if (!Ctor || data.byteLength === 0 || data.byteLength > MAX_ANALYSIS_BYTES) return null;
  try {
    const ctx = new Ctor(1, 1, ANALYSIS_SAMPLE_RATE);
    const buffer = await ctx.decodeAudioData(data);
    const samples = downmix(buffer, MAX_ANALYSIS_SECONDS * buffer.sampleRate);
    return estimateKey(samples, buffer.sampleRate);
  } catch (err) {
    console.warn("Key analysis failed:", err);
    return null;
  }
}

/** Detect the key of a local file (e.g. one about to be uploaded). */
export async function analyzeKeyFromFile(file: Blob): Promise<DetectedKey | null> {
  if (file.size > MAX_ANALYSIS_BYTES) return null;
  try {
    return await analyzeKeyFromArrayBuffer(await file.arrayBuffer());
  } catch {
    return null;
  }
}

/** Detect the key of an already-uploaded recording via its signed URL. */
export async function analyzeKeyFromUrl(url: string): Promise<DetectedKey | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const size = Number(res.headers.get("content-length"));
    if (size > MAX_ANALYSIS_BYTES) return null;
    return await analyzeKeyFromArrayBuffer(await res.arrayBuffer());
  } catch {
    return null;
  }
}
