// Slows down password guessing. Failures are counted per email and per network address; too many in a window locks that key for a while.
// A correct sign-in clears the email's count. This also means anyone can lock a known email out briefly, which is the price of the limit.
export const WINDOW_MS = 15 * 60_000;
export const LOCK_MS = 15 * 60_000;
export const LIMIT_EMAIL = 8;
export const LIMIT_IP = 40;

export type Guard = { count: number; first_at: number; locked_until: number };
export const FRESH: Guard = { count: 0, first_at: 0, locked_until: 0 };

export const isLocked = (g: Guard, now: number) => g.locked_until > now;

export function afterFailure(g: Guard, now: number, limit: number): Guard {
  const inWindow = g.first_at && now - g.first_at < WINDOW_MS;
  const count = inWindow ? g.count + 1 : 1;
  const first_at = inWindow ? g.first_at : now;
  return { count, first_at, locked_until: count >= limit ? now + LOCK_MS : 0 };
}

export const minutesLeft = (g: Guard, now: number) => Math.max(1, Math.ceil((g.locked_until - now) / 60_000));
