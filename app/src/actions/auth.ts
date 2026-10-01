"use server";

import { redirect } from "next/navigation";
import { signInWith, signOut } from "@/lib/auth";

export async function signIn(f: FormData) {
  const role = await signInWith(String(f.get("passcode") ?? "").trim());
  if (!role) redirect("/signin?error=1");
  redirect(role === "coach" ? "/coach" : "/science");
}

export async function signOutAction() {
  await signOut();
  redirect("/signin");
}
