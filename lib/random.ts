import { ADJECTIVES, NOUNS } from "@/lib/words";

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

/** Easy-to-type local-part like `calm-otter`. */
export function randomLocalPart(taken: Iterable<string> = []): string {
  const used = new Set([...taken].map(localFromTaken));
  for (let attempt = 0; attempt < 32; attempt++) {
    const candidate = `${pickWord(ADJECTIVES)}-${pickWord(NOUNS)}`;
    if (!used.has(candidate)) return candidate;
  }
  const extra = 10 + pickIndex(90);
  return `${pickWord(ADJECTIVES)}-${pickWord(NOUNS)}-${extra}`;
}

export function randomId(prefix = "msg"): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex}`;
}
