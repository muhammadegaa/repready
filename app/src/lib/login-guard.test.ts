import { describe, expect, it } from "vitest";
import { afterFailure, FRESH, isLocked, LIMIT_EMAIL, LOCK_MS, WINDOW_MS } from "./login-guard";

describe("login guard", () => {
  it("locks after the limit within the window, and not before", () => {
    let g = FRESH;
    const t = 1_000_000;
    for (let i = 0; i < LIMIT_EMAIL - 1; i++) { g = afterFailure(g, t + i, LIMIT_EMAIL); expect(isLocked(g, t + i)).toBe(false); }
    g = afterFailure(g, t + 100, LIMIT_EMAIL);
    expect(isLocked(g, t + 101)).toBe(true);
    expect(isLocked(g, t + 100 + LOCK_MS + 1)).toBe(false);
  });
  it("forgets old failures once the window has passed", () => {
    let g = FRESH;
    for (let i = 0; i < LIMIT_EMAIL - 1; i++) g = afterFailure(g, 1000 + i, LIMIT_EMAIL);
    g = afterFailure(g, 1000 + WINDOW_MS + 5, LIMIT_EMAIL);
    expect(g.count).toBe(1);
    expect(isLocked(g, 1000 + WINDOW_MS + 6)).toBe(false);
  });
});
