"use server";

import { saveLead } from "@/lib/store";

export type LeadState = { ok: boolean; message: string } | null;

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export async function joinWaitlist(_prev: LeadState, f: FormData): Promise<LeadState> {
  if (String(f.get("website") ?? "") !== "") return { ok: true, message: "You're on the list." }; // honeypot: bots fill this in
  const email = String(f.get("email") ?? "").trim();
  if (!EMAIL.test(email) || email.length > 254) return { ok: false, message: "That email does not look right." };
  await saveLead(email, "landing");
  return { ok: true, message: "You're on the list. We will email you when your place opens." };
}
