import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/server/rate-limit";

const LIMIT = 3;
const WINDOW_MS = 60_000;
const START = 1_000_000;

function callRepeatedly(times: number, call: () => boolean): boolean[] {
  return Array.from({ length: times }, call);
}

describe("createRateLimiter", () => {
  it("allows exactly `limit` calls in a window", () => {
    const isAllowed = createRateLimiter({ limit: LIMIT, windowMs: WINDOW_MS });

    const results = callRepeatedly(LIMIT, () => isAllowed("1.2.3.4", START));

    expect(results).toEqual([true, true, true]);
  });

  it("blocks the call after the limit", () => {
    const isAllowed = createRateLimiter({ limit: LIMIT, windowMs: WINDOW_MS });
    callRepeatedly(LIMIT, () => isAllowed("1.2.3.4", START));

    expect(isAllowed("1.2.3.4", START + WINDOW_MS - 1)).toBe(false);
  });

  it("allows calls again once the window has passed", () => {
    const isAllowed = createRateLimiter({ limit: LIMIT, windowMs: WINDOW_MS });
    callRepeatedly(LIMIT + 1, () => isAllowed("1.2.3.4", START));

    expect(isAllowed("1.2.3.4", START + WINDOW_MS)).toBe(true);
  });

  it("counts each key independently", () => {
    const isAllowed = createRateLimiter({ limit: LIMIT, windowMs: WINDOW_MS });
    callRepeatedly(LIMIT, () => isAllowed("1.2.3.4", START));

    expect(isAllowed("5.6.7.8", START)).toBe(true);
  });
});
