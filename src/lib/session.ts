import { cookies } from "next/headers";

const SESSION_COOKIE = "bb_session";
const BAND_COOKIE = "bb_band";

export async function setSessionCookies(
  sessionToken: string,
  bandId: string
) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  cookieStore.set(BAND_COOKIE, bandId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function getSessionCookies() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value ?? null;
  const bandId = cookieStore.get(BAND_COOKIE)?.value ?? null;
  return { sessionToken, bandId };
}

export async function clearSessionCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(BAND_COOKIE);
}
