import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { clubHasAccess } from "./billing";
import { getClub, getStaff, type StaffRole, type StaffRow } from "./store";

export type Session = { id: string; name: string; email: string; club: string; clubName: string; roles: StaffRole[]; admin: boolean; access: boolean };

// Was rr_s while staff had passwords. The new name ended every session from that time, including any held by
// someone who had made an account in another person's name.
const COOKIE = "rr_session";
const DAYS = 30;

// SESSION_SECRET signs the cookie. Without it the key is derived from the Firebase credential, which is already secret on the server.
const secret = () => process.env.SESSION_SECRET ?? createHash("sha256").update(`repready:${process.env.FIREBASE_SERVICE_ACCOUNT ?? "local-dev-only"}`).digest("hex");
const mac = (body: string) => createHmac("sha256", secret()).update(body).digest("hex");

const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export async function startSession(staff: StaffRow): Promise<void> {
  const exp = Date.now() + DAYS * 86_400_000;
  const body = `${staff.id}.${exp}`;
  (await cookies()).set(COOKIE, `${body}.${mac(body)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DAYS * 86_400,
  });
}

export const getSession = cache(async (): Promise<Session | null> => {
  const v = (await cookies()).get(COOKIE)?.value;
  const [id, exp, sig] = v?.split(".") ?? [];
  if (!id || !exp || !sig || !same(sig, mac(`${id}.${exp}`)) || Number(exp) < Date.now()) return null;
  const staff = await getStaff(id);
  if (!staff) return null;
  const club = await getClub(staff.club);
  if (!club) return null;
  return { id, name: staff.name, email: staff.email, club: staff.club, clubName: club.name, roles: staff.roles, admin: staff.admin, access: clubHasAccess(club) };
});

// For pages: send people without the role to sign in.
export async function requirePage(role: StaffRole): Promise<Session> {
  const s = await getSession();
  if (!s || !s.roles.includes(role)) redirect("/signin");
  if (!s.access) redirect("/subscribe");
  return s;
}

// For server actions: refuse instead of redirecting.
export async function requireStaff(role: StaffRole): Promise<Session> {
  const s = await getSession();
  if (!s || !s.roles.includes(role)) throw new Error(`Not signed in as ${role}`);
  if (!s.access) throw new Error("This club has not subscribed yet");
  return s;
}

export async function requireAdmin(): Promise<Session> {
  const s = await getSession();
  if (!s || !s.admin) throw new Error("Only a club admin can do this");
  return s;
}

export const homeFor = (s: Pick<Session, "roles">) => (s.roles.includes("coach") ? "/coach" : "/science");

export async function signOut(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

// The people who run the pilot (not club staff) are listed by email in PLATFORM_ADMIN_EMAILS. Empty means nobody.
export const isPlatformAdmin = (email: string) =>
  (process.env.PLATFORM_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean).includes(email.trim().toLowerCase());
