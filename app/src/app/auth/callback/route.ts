import { redirect } from "next/navigation";
import { homeFor, startSession } from "@/lib/auth";
import { finishSigno } from "@/lib/signo";
import { acceptStaffInvite, confirmEmail, createClubWithOwner, getStaffByEmail } from "@/lib/store";

function back(path: string, error: string): never {
  redirect(`${path}?error=${encodeURIComponent(error)}`);
}

// signo sends people here after they sign in there. The email it confirmed is the account: it signs someone in,
// makes a new club's admin, or joins someone to a club's staff with an invite.
export async function GET(req: Request) {
  const done = await finishSigno(new URL(req.url).search);
  const { intent } = done;
  const page = intent.kind === "signup" ? "/signup" : intent.kind === "join" ? `/join/staff/${intent.token}` : "/signin";
  if ("error" in done) back(page, done.error);
  const { email } = done;

  if (intent.kind === "signup") {
    const made = await createClubWithOwner(intent.club, { email, name: intent.name });
    if (!made) back(page, "That email already has an account. Sign in instead.");
    await startSession(made.staff);
    redirect("/coach");
  }
  if (intent.kind === "join") {
    const joined = await acceptStaffInvite(intent.token, { email, name: intent.name });
    if (joined === "taken") back(page, "That email already has an account. Sign in instead.");
    if (joined === "invalid") back(page, "This invite has expired or was already used. Ask your club admin for a new one.");
    await startSession(joined);
    redirect(homeFor(joined));
  }
  const staff = await getStaffByEmail(email);
  if (!staff) back(page, `No RepReady account uses ${email}. Create a club, or ask your club admin for a staff invite.`);
  // Accounts made with a password before signo may never have confirmed their email. signo just did.
  if (!staff.verified_at) await confirmEmail(staff.id);
  await startSession(staff);
  redirect(homeFor(staff));
}
