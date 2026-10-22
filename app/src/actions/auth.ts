"use server";

import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import { startSigno, type Intent } from "@/lib/signo";
import { getInvite, inviteUsable } from "@/lib/store";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const fail = (path: string, msg: string): never => redirect(`${path}?error=${encodeURIComponent(msg)}`);

// Sends the person to signo, which confirms their email; app/auth/callback does the rest.
async function toSigno(intent: Intent, path: string) {
  const url = await startSigno(intent).catch((error) => {
    console.error(error);
    return null;
  });
  if (!url) return fail(path, "signo could not be reached, so you can't sign in just now. Try again in a minute.");
  redirect(url);
}

export async function signIn() {
  await toSigno({ kind: "signin" }, "/signin");
}

export async function signUp(f: FormData) {
  const club = text(f, "club").slice(0, 80);
  const name = text(f, "name").slice(0, 80);
  if (!club) fail("/signup", "Enter the club name.");
  if (!name) fail("/signup", "Enter your name.");
  await toSigno({ kind: "signup", club, name }, "/signup");
}

export async function joinStaff(f: FormData) {
  const token = text(f, "token");
  const path = `/join/staff/${token}`;
  const name = text(f, "name").slice(0, 80);
  if (!name) fail(path, "Enter your name.");
  const invite = await getInvite(token);
  if (!inviteUsable(invite) || invite.kind !== "staff") fail(path, "This invite has expired or was already used. Ask your club admin for a new one.");
  await toSigno({ kind: "join", token, name }, path);
}

export async function signOutAction() {
  await signOut();
  redirect("/signin");
}
