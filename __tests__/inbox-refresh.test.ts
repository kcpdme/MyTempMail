import { describe, expect, it } from "vitest";
import {
  STANDARD_POLL_MS,
  WATCH_DURATION_MS,
  WATCH_POLL_MS,
  formatWatchRemaining,
  watchRemainingSeconds,
} from "@/lib/inbox-refresh";

describe("inbox refresh timing", () => {
  it("uses a 30-second default and a three-minute 5-second watch window", () => {
    expect(STANDARD_POLL_MS).toBe(30_000);
    expect(WATCH_POLL_MS).toBe(5_000);
    expect(WATCH_DURATION_MS).toBe(180_000);
  });

  it("rounds the watch countdown up and clamps expired windows", () => {
    expect(watchRemainingSeconds(10_001, 10_000)).toBe(1);
    expect(watchRemainingSeconds(70_001, 10_000)).toBe(61);
    expect(watchRemainingSeconds(9_999, 10_000)).toBe(0);
    expect(watchRemainingSeconds(null, 10_000)).toBe(0);
  });

  it("formats the remaining watch time", () => {
    expect(formatWatchRemaining(180)).toBe("3:00");
    expect(formatWatchRemaining(65)).toBe("1:05");
    expect(formatWatchRemaining(0)).toBe("0:00");
  });
});
