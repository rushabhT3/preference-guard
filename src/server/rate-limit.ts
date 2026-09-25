export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

/** Returns true when the call is allowed. */
export type RateLimiter = (key: string, now: number) => boolean;

interface FixedWindow {
  startedAt: number;
  count: number;
}

export function createRateLimiter({
  limit,
  windowMs,
}: RateLimitOptions): RateLimiter {
  const windows = new Map<string, FixedWindow>();
  const pruneExpired = (now: number) => {
    for (const [key, window] of windows) {
      if (now - window.startedAt >= windowMs) windows.delete(key);
    }
  };
  return (key, now) => {
    pruneExpired(now);
    const current = windows.get(key) ?? { startedAt: now, count: 0 };
    if (current.count >= limit) return false;
    windows.set(key, {
      startedAt: current.startedAt,
      count: current.count + 1,
    });
    return true;
  };
}
