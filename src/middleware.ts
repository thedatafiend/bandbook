import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get("bb_session")?.value;
  const bandId = request.cookies.get("bb_band")?.value;
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname === "/" || pathname.startsWith("/join");
  const isApi = pathname.startsWith("/api");

  // Let API routes handle their own auth
  if (isApi) return NextResponse.next();

  // No session → redirect to landing
  if (!sessionToken || !bandId) {
    if (isAuthPage) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Has session + on auth page → redirect to songs
  if (isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/songs";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
