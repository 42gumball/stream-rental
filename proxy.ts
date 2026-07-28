import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Next.js 16: this is the renamed "middleware". It optimistically gates pages
// behind the owner login. Public paths (login, cron, auth) are allowed through.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname.startsWith("/welcome") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/auth");

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const authed = (await verifySessionToken(token)) !== null;

  if (!authed && !isPublic) {
    const url = req.nextUrl.clone();
    // Send first-time visitors landing on the site root to the marketing page;
    // deep links still go to login so they return there after signing in.
    url.pathname = pathname === "/" ? "/welcome" : "/login";
    return NextResponse.redirect(url);
  }

  // Logged-in owners never need the marketing or login pages.
  if (authed && (pathname.startsWith("/login") || pathname.startsWith("/welcome"))) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)"],
};
