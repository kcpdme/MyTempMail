import { describe, expect, it } from "vitest";
import { isValidLocalPart } from "@/lib/domains";
import { randomLocalPart } from "@/lib/random";
import { ADJECTIVES, NOUNS } from "@/lib/words";

const SHAPE = /^[a-z]+-[a-z]+-[2-9a-hjkmnp-z]{6}$/;

describe("randomLocalPart", () => {
  it("returns adjective-noun plus a 6-char suffix", () => {
    const value = randomLocalPart();
    expect(value).toMatch(SHAPE);
    expect(isValidLocalPart(value)).toBe(true);
    const [adj, noun, suffix] = value.split("-");
    expect(ADJECTIVES).toContain(adj);
    expect(NOUNS).toContain(noun);
    expect(suffix).toHaveLength(6);
  });

  it("avoids local-parts that are already taken", () => {
    const first = randomLocalPart();
    const second = randomLocalPart([first]);
    expect(second).toMatch(SHAPE);
    expect(second).not.toBe(first);
  });

  it("does not collide across many draws", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add(randomLocalPart(seen));
    }
    expect(seen.size).toBe(200);
  });
});
