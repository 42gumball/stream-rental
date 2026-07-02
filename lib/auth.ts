import { SignJWT, jwtVerify } from "jose";

// Session tokens (jose only — this file is imported by proxy.ts, so it must
// stay free of Node-only APIs). Password hashing lives in lib/password.ts.

export const SESSION_COOKIE = "sr_session";
const ALG = "HS256";

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET || "dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

// Create a signed session token for a user (valid 30 days).
export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

// Returns the userId if the token is valid, otherwise null.
export async function verifySessionToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return typeof payload.uid === "string" ? payload.uid : null;
  } catch {
    return null;
  }
}
