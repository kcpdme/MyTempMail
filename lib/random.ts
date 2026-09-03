import { ADJECTIVES, NOUNS } from "@/lib/words";

const SUFFIX_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const SUFFIX_LENGTH = 6;

function pickIndex(length: number): number {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] % length;
}

function pickWord(list: readonly string[]): string {
  return list[pickIndex(list.length)];
}

function localFromTaken(value: string): string {
  const at = value.lastIndexOf("@");
  return (at > 0 ? value.slice(0, at) : value).toLowerCase();
}

function randomSuffix(length = SUFFIX_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += SUFFIX_ALPHABET[bytes[i]! % SUFFIX_ALPHABET.length];
  }
  return out;
}

/** Easy-to-type unique local-part like `calm-otter-k7n2qm`. */
export function randomLocalPart(taken: Iterable<string> = []): string {
  const used = new Set([...taken].map(localFromTaken));
  for (let attempt = 0; attempt < 32; attempt++) {
    const candidate = `${pickWord(ADJECTIVES)}-${pickWord(NOUNS)}-${randomSuffix()}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${pickWord(ADJECTIVES)}-${pickWord(NOUNS)}-${randomSuffix()}${randomSuffix()}`;
}

export function randomId(prefix = "msg"): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex}`;
}
