import { cookies } from "next/headers";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { claimLink, getAthlete, type AthleteRow } from "./store";

const cookieName = (code: string) => `rr_p_${code}`;

const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

// True when this browser holds the token the link was claimed with.
export async function isLinkOwner(a: Pick<AthleteRow, "code" | "device_token">): Promise<boolean> {
  if (!a.device_token) return false;
  const have = (await cookies()).get(cookieName(a.code))?.value;
  return Boolean(have) && same(have!, a.device_token);
}

// Claims the link for this browser if nobody has. Returns whether this browser now owns it.
export async function claimThisDevice(code: string): Promise<boolean> {
  const token = randomBytes(24).toString("hex");
  if (!(await claimLink(code, token))) return false;
  (await cookies()).set(cookieName(code), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return true;
}

// Guard for player actions: the player must exist, have agreed, and be on the phone that claimed the link.
export async function requirePlayer(code: string): Promise<AthleteRow> {
  const a = await getAthlete(code);
  if (!a || !a.consented_at || !(await isLinkOwner(a))) throw new Error("This link is not active on this device.");
  return a;
}
