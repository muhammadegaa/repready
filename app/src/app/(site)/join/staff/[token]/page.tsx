import { joinStaff } from "@/actions/auth";
import { PendingButton } from "@/components/Pending";
import { btn, Card, input, Notice } from "@/components/ui";
import { PASSWORD_MIN } from "@/lib/auth";
import { getClub, getInvite, inviteUsable } from "@/lib/store";

export const metadata = { title: "Join your club staff" };
export const dynamic = "force-dynamic";

export default async function JoinStaff(props: PageProps<"/join/staff/[token]">) {
  const { token } = await props.params;
  const { error } = await props.searchParams;
  const invite = await getInvite(token);
  const club = inviteUsable(invite) && invite.kind === "staff" ? await getClub(invite.club) : null;
  if (!invite || !club) {
    return (
      <div className="mx-auto max-w-sm space-y-2 pt-10">
        <h1 className="text-2xl font-semibold tracking-tight">This invite is not valid</h1>
        <p className="text-sm text-muted">It has expired or was already used. Ask your club admin for a new staff invite.</p>
      </div>
    );
  }
  const as = invite.roles.length === 2 ? "coach and sports scientist" : invite.roles[0] === "scientist" ? "sports scientist" : "coach";
  return (
    <div className="mx-auto max-w-sm pt-10">
      <h1 className="text-2xl font-semibold tracking-tight">Join {club.name}</h1>
      <p className="mt-1 text-sm text-muted">You are invited as {as}. Create your account.</p>
      <Card className="mt-6 p-5">
        {typeof error === "string" && <div className="mb-4"><Notice tone="bad">{error}</Notice></div>}
        <form action={joinStaff} className="space-y-3">
          <input type="hidden" name="token" value={token} />
          <label htmlFor="name" className="block text-sm font-medium">Your name</label>
          <input id="name" name="name" autoComplete="name" required maxLength={80} className={input} autoFocus />
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className={input} />
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN} className={input} />
          <p className="text-xs text-muted">At least {PASSWORD_MIN} characters.</p>
          <PendingButton className={`${btn} w-full`} pending="Joining…">Join {club.name}</PendingButton>
        </form>
      </Card>
    </div>
  );
}
