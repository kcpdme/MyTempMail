const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function randomLocalPart(length = 10): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  if (!/^[a-z]/.test(out)) {
    out = "a" + out.slice(1);
  }
  return out;
}

export function randomId(prefix = "msg"): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex}`;
}
