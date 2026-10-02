import { joinSquad } from "@/actions/athlete";
import { PendingButton } from "@/components/Pending";
import { btn, input, Notice } from "@/components/ui";
import { getClub, getInvite, inviteUsable } from "@/lib/store";
import { POSITIONS } from "@/lib/squad";

export const metadata = { title: "Join your squad" };
export const dynamic = "force-dynamic";

export default async function JoinSquad(props: PageProps<"/join/[token]">) {
  const { token } = await props.params;
  const { error } = await props.searchParams;
  const invite = await getInvite(token);
  const club = inviteUsable(invite) && invite.kind === "squad" ? await getClub(invite.club) : null;
  if (!club) {
    return (
      <div className="space-y-2 pt-4">
        <h1 className="text-2xl font-semibold tracking-tight">This link is not active</h1>
        <p className="text-[15px] text-muted">Ask your club for the current squad link.</p>
      </div>
    );
  }
  return (
    <div className="space-y-5 pt-4">
      <h1 className="text-3xl font-semibold tracking-tight">Join {club.name}</h1>
      <p className="text-[15px] leading-relaxed">Add yourself to the squad. Staff confirm you, then you check in each morning on this phone.</p>
      {typeof error === "string" && <Notice tone="bad">{error}</Notice>}
      <form action={joinSquad} className="space-y-3">
        <input type="hidden" name="token" value={token} />
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium">Your name</label>
          <input id="name" name="name" autoComplete="name" required maxLength={80} className={input} />
        </div>
        <div className="grid grid-cols-[5.5rem_1fr] gap-2">
          <div>
            <label htmlFor="shirt" className="mb-1 block text-sm font-medium">Shirt no.</label>
            <input id="shirt" name="shirt" type="number" min={1} max={99} className={input} />
          </div>
          <div>
            <label htmlFor="position" className="mb-1 block text-sm font-medium">Position</label>
            <select id="position" name="position" defaultValue="" className={input}><option value="">Choose</option>{POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
          </div>
        </div>
        <div>
          <label htmlFor="squad" className="mb-1 block text-sm font-medium">Squad</label>
          <input id="squad" name="squad" defaultValue="First team" maxLength={30} className={input} />
        </div>
        <label className="flex items-start gap-3 text-[15px]"><input type="checkbox" name="adult" value="yes" required className="mt-1 h-4 w-4" />I am 18 or over.</label>
        <PendingButton className={`${btn} w-full py-3`} pending="One moment…">Join the squad</PendingButton>
      </form>
    </div>
  );
}
