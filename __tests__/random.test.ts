import { describe, expect, it } from "vitest";
import { randomLocalPart } from "@/lib/random";
import { ADJECTIVES, NOUNS } from "@/lib/words";

describe("randomLocalPart", () => {
  it("returns adjective-noun from the dictionary", () => {
    const value = randomLocalPart();
    expect(value).toMatch(/^[a-z]+-[a-z]+$/);
    const [adj, noun] = value.split("-");
    expect(ADJECTIVES).toContain(adj);
    expect(NOUNS).toContain(noun);
  });

  it("avoids local-parts that are already taken", () => {
    const taken = ADJECTIVES.flatMap((adj) => NOUNS.map((noun) => `${adj}-${noun}`));
    const value = randomLocalPart(taken);
    expect(value).toMatch(/^[a-z]+-[a-z]+-\d{2}$/);
  });
});
