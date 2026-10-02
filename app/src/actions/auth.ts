"use server";

import { redirect } from "next/navigation";
import { checkPassword, hashPassword, homeFor, PASSWORD_MIN, signOut, startSession } from "@/lib/auth";
import { acceptStaffInvite, createClubWithOwner, getStaffByEmail } from "@/lib/store";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const fail = (path: string, msg: string): never => redirect(`${path}?error=${encodeURIComponent(msg)}`);

function accountFields(f: FormData, path: string) {
  const name = text(f, "name").slice(0, 80);
  const email = text(f, "email").toLowerCase();
  const password = String(f.get("password") ?? "");
  if (!name) fail(path, "Enter your name.");
  if (!EMAIL.test(email) || email.length > 254) fail(path, "That email does not look right.");
  if (password.length < PASSWORD_MIN) fail(path, `Use a password of at least ${PASSWORD_MIN} characters.`);
  return { name, email, pw: hashPassword(password) };
}

export async function signIn(f: FormData) {
  const staff = await getStaffByEmail(text(f, "email"));
  const ok = checkPassword(String(f.get("password") ?? ""), staff?.pw ?? null);
  if (!staff || !ok) fail("/signin", "That email and password did not match.");
  await startSession(staff!);
  redirect(homeFor(staff!));
}

export async function signUp(f: FormData) {
  const club = text(f, "club").slice(0, 80);
  if (!club) fail("/signup", "Enter the club name.");
  const owner = accountFields(f, "/signup");
  const made = await createClubWithOwner(club, owner);
  if (!made) fail("/signup", "That email already has an account. Sign in instead.");
  await startSession(made!.staff);
  redirect("/coach/squad");
}

export async function joinStaff(f: FormData) {
  const token = text(f, "token");
  const path = `/join/staff/${token}`;
  const who = accountFields(f, path);
  const res = await acceptStaffInvite(token, who);
  if (res === "taken") fail(path, "That email already has an account. Sign in instead.");
  if (res === "invalid") fail(path, "This invite has expired or was already used. Ask your club admin for a new one.");
  await startSession(res as Exclude<typeof res, string>);
  redirect(homeFor(res as Exclude<typeof res, string>));
}

export async function signOutAction() {
  await signOut();
  redirect("/signin");
}
