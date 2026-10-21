/**
 * Musical key representation shared by the API (validation) and the UI
 * (display). A key is stored as a tonic pitch class (0 = C … 11 = B) plus a
 * mode rather than a display string, so spelling (sharps vs. flats) is a
 * presentation choice and transposition stays simple arithmetic.
 */

export type KeyMode = "major" | "minor";

export interface MusicalKey {
  tonic: number;
  mode: KeyMode;
}

/** A key estimated from audio, with the analyzer's confidence (0–1). */
export interface DetectedKey extends MusicalKey {
  confidence: number;
}

// Conventional key-signature spellings: flats for the flat-side keys, sharps
// for the sharp side (F♯ major / E♭ minor chosen over G♭ major / D♯ minor).
const MAJOR_TONIC_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const MINOR_TONIC_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "G♯", "A", "B♭", "B"];

export function tonicName(key: MusicalKey): string {
  return (key.mode === "major" ? MAJOR_TONIC_NAMES : MINOR_TONIC_NAMES)[key.tonic];
}

/** "E♭ major", "F♯ minor" */
export function formatKey(key: MusicalKey): string {
  return `${tonicName(key)} ${key.mode}`;
}

/** Stable identifier for a key, e.g. for <select> option values: "3:major". */
export function keyId(key: MusicalKey): string {
  return `${key.tonic}:${key.mode}`;
}

export function parseKeyId(id: string): MusicalKey | null {
  const match = /^(\d{1,2}):(major|minor)$/.exec(id);
  if (!match) return null;
  const tonic = Number(match[1]);
  if (tonic > 11) return null;
  return { tonic, mode: match[2] as KeyMode };
}

export function keysEqual(
  a: MusicalKey | null | undefined,
  b: MusicalKey | null | undefined
): boolean {
  if (!a || !b) return !a && !b;
  return a.tonic === b.tonic && a.mode === b.mode;
}

/** All 24 major/minor keys, majors first, each ordered C → B. */
export const ALL_KEYS: MusicalKey[] = (["major", "minor"] as const).flatMap((mode) =>
  Array.from({ length: 12 }, (_, tonic) => ({ tonic, mode }))
);

/** Build a key from nullable DB columns; null unless both are set and valid. */
export function keyFromColumns(
  tonic: number | null | undefined,
  mode: string | null | undefined
): MusicalKey | null {
  if (tonic == null || mode == null) return null;
  if (!isValidTonic(tonic) || (mode !== "major" && mode !== "minor")) return null;
  return { tonic, mode };
}

function isValidTonic(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 11;
}

export type KeyInputResult<T> = { ok: true; value: T | null } | { ok: false; error: string };

/**
 * Validate an untrusted request value as a key. `null` clears the key.
 */
export function parseKeyInput(value: unknown): KeyInputResult<MusicalKey> {
  if (value === null) return { ok: true, value: null };
  if (typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Key must be an object with tonic and mode, or null" };
  }
  const { tonic, mode } = value as Record<string, unknown>;
  if (!isValidTonic(tonic)) {
    return { ok: false, error: "Key tonic must be an integer between 0 and 11" };
  }
  if (mode !== "major" && mode !== "minor") {
    return { ok: false, error: "Key mode must be 'major' or 'minor'" };
  }
  return { ok: true, value: { tonic, mode } };
}

/**
 * Validate an untrusted request value as an analyzer result. `null` clears
 * a previous detection.
 */
export function parseDetectedKeyInput(value: unknown): KeyInputResult<DetectedKey> {
  const base = parseKeyInput(value);
  if (!base.ok || base.value === null) return base as KeyInputResult<DetectedKey>;
  const { confidence } = value as Record<string, unknown>;
  if (
    typeof confidence !== "number" ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1
  ) {
    return { ok: false, error: "Key confidence must be a number between 0 and 1" };
  }
  return { ok: true, value: { ...base.value, confidence } };
}
