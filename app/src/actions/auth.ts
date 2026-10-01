"use server";

import { redirect } from "next/navigation";
import { signInWith, signOut, switchRole } from "@/lib/auth";

export async function signIn(f: FormData) {
  const prefer = f.get("view") === "scientist" ? "scientist" : "coach";
  const role = await signInWith(String(f.get("passcode") ?? "").trim(), prefer);
  if (!role) redirect("/signin?error=1");
  redirect(role === "coach" ? "/coach" : "/science");
}

export async function signOutAction() {
  await signOut();
  redirect("/signin");
}

export async function switchView() {
  const role = await switchRole();
  redirect(role === "scientist" ? "/science" : "/coach");
}
