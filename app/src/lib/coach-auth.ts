import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";

const token = (passcode: string) => createHash("sha256").update(`adapt:${passcode}`).digest("hex");

export const coachEnabled = () => Boolean(process.env.COACH_PASSCODE);

export async function isCoach(): Promise<boolean> {
  const pass = process.env.COACH_PASSCODE;
  if (!pass) return false;
  const have = (await cookies()).get("coach")?.value;
  if (!have) return false;
  const a = Buffer.from(have), b = Buffer.from(token(pass));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function requireCoach(): Promise<void> {
  if (!(await isCoach())) throw new Error("Not signed in as coach");
}

export async function signIn(attempt: string): Promise<boolean> {
  const pass = process.env.COACH_PASSCODE;
  if (!pass) return false;
  const a = Buffer.from(token(attempt)), b = Buffer.from(token(pass));
  if (!timingSafeEqual(a, b)) return false;
  (await cookies()).set("coach", token(pass), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return true;
}

export async function signOut(): Promise<void> {
  (await cookies()).delete("coach");
}
