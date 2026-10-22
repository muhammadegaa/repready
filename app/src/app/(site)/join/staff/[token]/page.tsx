import { joinStaff } from "@/actions/auth";
import { PendingButton } from "@/components/Pending";
import { SignoMark } from "@/components/SignoMark";
import { Card, input, Notice } from "@/components/ui";
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
          <PendingButton className="signo-button w-full justify-center" pending="Opening signo…"><SignoMark />Join with signo</PendingButton>
        </form>
        <p className="mt-3 text-sm text-muted">signo confirms your email with a passkey or a code it sends you. That email is your account.</p>
      </Card>
    </div>
  );
}
