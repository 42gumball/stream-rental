import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth";
import { findOrCreateGoogleUser } from "@/lib/users";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

// Step 2 of Google sign-in: exchange the code, fetch the profile, sign the user
// in (creating/linking their account), and redirect home.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const savedState = req.cookies.get("g_oauth_state")?.value;

  const fail = (err: string) => {
    const r = NextResponse.redirect(new URL(`/login?error=${err}`, origin));
    r.cookies.set("g_oauth_state", "", { path: "/", maxAge: 0 });
    return r;
  };

  if (!code || !state || !savedState || state !== savedState) return fail("google");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail("google_unconfigured");

  try {
    // Exchange the authorization code for tokens.
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) return fail("google");
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) return fail("google");

    // Fetch the user's profile.
    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!infoRes.ok) return fail("google");
    const info = (await infoRes.json()) as {
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
    };
    if (!info.sub || !info.email) return fail("google");

    const user = await findOrCreateGoogleUser({
      googleId: info.sub,
      email: info.email,
      name: info.name,
      image: info.picture,
    });

    const token = await createSessionToken(user.id);
    const res = NextResponse.redirect(new URL("/", origin));
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: THIRTY_DAYS,
    });
    res.cookies.set("g_oauth_state", "", { path: "/", maxAge: 0 });
    return res;
  } catch {
    return fail("google");
  }
}
