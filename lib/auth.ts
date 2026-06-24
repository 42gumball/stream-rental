import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "sr_session";
const ALG = "HS256";

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET || "dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

// Verify the owner password typed at login.
export function checkPassword(password: string): boolean {
  const expected = process.env.APP_PASSWORD || "changeme";
  return password === expected;
}

// Create a signed session token (valid 30 days).
export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "owner" })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.role === "owner";
  } catch {
    return false;
  }
}
