export const STANDARD_POLL_MS = 30_000;
export const WATCH_POLL_MS = 5_000;
export const WATCH_DURATION_MS = 3 * 60_000;

export function watchRemainingSeconds(watchUntil: number | null, now = Date.now()): number {
  if (!watchUntil) return 0;
  return Math.max(0, Math.ceil((watchUntil - now) / 1000));
}

export function formatWatchRemaining(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}
