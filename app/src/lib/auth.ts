import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";

export type Role = "coach" | "scientist";

const passcodeFor = (r: Role) => (r === "coach" ? process.env.COACH_PASSCODE : process.env.SCIENTIST_PASSCODE);
const sig = (role: Role, pass: string) => createHash("sha256").update(`repready:${role}:${pass}`).digest("hex");
const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export const roleEnabled = (r: Role) => Boolean(passcodeFor(r));

export async function getRole(): Promise<Role | null> {
  const v = (await cookies()).get("rr_role")?.value;
  if (!v) return null;
  const [role, s] = v.split(".");
  if (role !== "coach" && role !== "scientist") return null;
  const pass = passcodeFor(role);
  return pass && s && same(s, sig(role, pass)) ? role : null;
}

export async function requireRole(role: Role): Promise<void> {
  if ((await getRole()) !== role) throw new Error(`Not signed in as ${role}`);
}

// True when one passcode opens both views, so a signed-in person can switch without typing it again.
export const sharedPasscode = () => Boolean(process.env.COACH_PASSCODE) && process.env.COACH_PASSCODE === process.env.SCIENTIST_PASSCODE;

function setRole(role: Role, pass: string, jar: Awaited<ReturnType<typeof cookies>>) {
  jar.set("rr_role", `${role}.${sig(role, pass)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function switchRole(): Promise<Role | null> {
  const current = await getRole();
  if (!current || !sharedPasscode()) return null;
  const next: Role = current === "coach" ? "scientist" : "coach";
  setRole(next, passcodeFor(next)!, await cookies());
  return next;
}

// With one shared passcode the person's choice decides the view; otherwise the passcode does.
export async function signInWith(attempt: string, prefer: Role = "coach"): Promise<Role | null> {
  const order: Role[] = prefer === "coach" ? ["coach", "scientist"] : ["scientist", "coach"];
  for (const role of order) {
    const pass = passcodeFor(role);
    if (pass && same(sig(role, attempt), sig(role, pass))) {
      setRole(role, pass, await cookies());
      return role;
    }
  }
  return null;
}

export async function signOut(): Promise<void> {
  (await cookies()).delete("rr_role");
}
