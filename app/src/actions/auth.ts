"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, getSession, hashPassword, homeFor, PASSWORD_MIN, signOut, startSession } from "@/lib/auth";
import { sendMail } from "@/lib/mail";
import { acceptStaffInvite, createClubWithOwner, createEmailVerification, createPasswordReset, getStaffByEmail, resetPassword } from "@/lib/store";

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
  await sendVerification(made!.staff.id);
  redirect("/coach");
}

async function sendVerification(staffId: string): Promise<"sent" | "throttled" | "done" | "failed"> {
  const v = await createEmailVerification(staffId);
  if (v === "throttled" || v === "done") return v;
  if (!v) return "failed";
  const r = await sendMail({
    to: v.email,
    subject: "Confirm your email for RepReady",
    text: `Confirm this email address for your RepReady account (the link works for 24 hours):\n${await origin()}/verify/${v.token}\n\nIf you did not create an account, ignore this email.`,
  });
  if (!r.sent) console.error(`[mail] confirmation email to ${v.email} failed: ${r.error}`);
  return r.sent ? "sent" : "failed";
}

export async function resendVerification() {
  const s = await getSession();
  if (!s) redirect("/signin");
  const r = await sendVerification(s.id);
  redirect(`/verify/sent?r=${r}`);
}

export async function joinStaff(f: FormData) {
  const token = text(f, "token");
  const path = `/join/staff/${token}`;
  const who = accountFields(f, path);
  const res = await acceptStaffInvite(token, who);
  if (res === "taken") fail(path, "That email already has an account. Sign in instead.");
  if (res === "invalid") fail(path, "This invite has expired or was already used. Ask your club admin for a new one.");
  const joined = res as Exclude<typeof res, string>;
  await startSession(joined);
  await sendVerification(joined.id);
  redirect(homeFor(joined));
}

export async function signOutAction() {
  await signOut();
  redirect("/signin");
}

async function origin(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
}

// The reply is the same whether or not the email has an account, so the form cannot be used to find out who is a member.
export async function requestReset(f: FormData) {
  const email = text(f, "email").toLowerCase();
  if (EMAIL.test(email) && email.length <= 254) {
    const made = await createPasswordReset(email);
    if (made && made !== "throttled") {
      await sendMail({
        to: made.staff.email,
        subject: "Reset your RepReady password",
        text: `Someone asked to reset the password for this RepReady account.\n\nChoose a new password here (works once, for 60 minutes):\n${await origin()}/reset/${made.token}\n\nIf this was not you, ignore this email. Your password has not changed.`,
      });
    }
  }
  redirect("/forgot?sent=1");
}

export async function setNewPassword(f: FormData) {
  const token = text(f, "token");
  const path = `/reset/${token}`;
  const password = String(f.get("password") ?? "");
  if (password.length < PASSWORD_MIN) fail(path, `Use a password of at least ${PASSWORD_MIN} characters.`);
  const res = await resetPassword(token, hashPassword(password));
  if (res === "invalid") fail("/forgot", "That reset link has expired or was already used. Ask for a new one.");
  await startSession(res as Exclude<typeof res, string>);
  redirect(homeFor(res as Exclude<typeof res, string>));
}
