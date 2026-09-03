import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);

const KEYLEN = 32;
const SALT_LEN = 16;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const DUMMY_SALT = Buffer.alloc(SALT_LEN, 7);

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(SALT_LEN);
  const derived = (await scrypt(password, salt, KEYLEN)) as Buffer;
  return { hash: derived.toString("hex"), salt: salt.toString("hex") };
}

export async function verifyPassword(password: string, hashHex: string, saltHex: string): Promise<boolean> {
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    if (!salt.length || expected.length !== KEYLEN) {
      await dummyVerify(password);
      return false;
    }
    const derived = (await scrypt(password, salt, KEYLEN)) as Buffer;
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** Spend a similar amount of CPU when the share is missing or expired. */
export async function dummyVerify(password: string): Promise<void> {
  await scrypt(password || "x", DUMMY_SALT, KEYLEN);
}

export function generateGuestPassword(length = 16): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}
