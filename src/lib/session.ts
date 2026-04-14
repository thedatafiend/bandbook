import { cookies } from "next/headers";

const BAND_COOKIE = "bb_band";

export async function setBandCookie(bandId: string) {
  const cookieStore = await cookies();
  cookieStore.set(BAND_COOKIE, bandId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
}

export async function getBandCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(BAND_COOKIE)?.value ?? null;
}

export async function clearBandCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(BAND_COOKIE);
}
