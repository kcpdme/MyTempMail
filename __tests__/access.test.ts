import { describe, expect, it } from "vitest";
import { signAccessToken, verifyAccessPassword, verifyAccessToken } from "@/lib/access";

describe("access tokens", () => {
  it("accepts a matching password", () => {
    const prev = process.env.ACCESS_PASSWORD;
    process.env.ACCESS_PASSWORD = "s3cret";
    try {
      expect(verifyAccessPassword("s3cret")).toBe(true);
      expect(verifyAccessPassword("wrong")).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.ACCESS_PASSWORD;
      else process.env.ACCESS_PASSWORD = prev;
    }
  });

  it("round-trips a signed cookie token", async () => {
    const token = await signAccessToken("s3cret");
    expect(await verifyAccessToken(token, "s3cret")).toBe(true);
    expect(await verifyAccessToken(token, "other")).toBe(false);
    expect(await verifyAccessToken("not-a-token", "s3cret")).toBe(false);
  });
});
