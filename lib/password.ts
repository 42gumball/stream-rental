import "server-only";
import { scrypt as _scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Password hashing with Node's built-in scrypt — no external dependency, no
// native build. Stored as "salt:hash" (both hex). Never imported by proxy.ts.
const scrypt = promisify(_scrypt) as (pw: string, salt: string, keylen: number) => Promise<Buffer>;
const KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, KEYLEN);
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const keyBuf = Buffer.from(key, "hex");
  const derived = await scrypt(password, salt, KEYLEN);
  return keyBuf.length === derived.length && timingSafeEqual(keyBuf, derived);
}
