import Link from "next/link";
import { deleteWholeClub, inviteStaff, removeStaffMember, revokeStaffInvite } from "@/actions/club";
import { CopyButton } from "@/components/CopyButton";
import { Live } from "@/components/Live";
import { PendingButton } from "@/components/Pending";
import { btn, btnGhost, Card, Chip, Eyebrow, input } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { ago } from "@/lib/copy";
import { getPulse, listOpenStaffInvites, listStaff, STAFF_INVITE_DAYS, type StaffRole } from "@/lib/store";

export const metadata = { title: "Staff" };
export const dynamic = "force-dynamic";

const roleLabel = (roles: StaffRole[]) => (roles.length === 2 ? "Coach and sports scientist" : roles[0] === "scientist" ? "Sports scientist" : "Coach");

export default async function Team(props: PageProps<"/coach/team">) {
  const { deleteerr } = await props.searchParams;
  const { club, clubName, admin, id: me } = await requirePage("coach");
  const [staff, invites, pulse] = await Promise.all([listStaff(club), admin ? listOpenStaffInvites(club) : Promise.resolve([]), getPulse(club, "coach")]);

  return (
    <div className="space-y-8">
      <Live scope="coach" initial={pulse} />
      <header>
        <Link href="/coach" className="text-sm text-muted hover:text-ink">← Today</Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Staff</h1>
        <p className="mt-1 text-muted">Everyone who can sign in to {clubName}. Coaches review proposals and manage the squad. Sports scientists edit the rules and check the agent.</p>
      </header>

      <section className="space-y-3">
        <Eyebrow>Signed-in staff · {staff.length}</Eyebrow>
        <Card className="divide-y divide-line">
          {staff.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <div className="font-medium">{s.name}{s.id === me ? <span className="ml-2 text-xs font-normal text-muted">you</span> : null}</div>
                <div className="truncate text-xs text-muted">{s.email}</div>
              </div>
              <div className="flex items-center gap-3">
                <Chip tone="neutral">{s.admin ? "Admin · " : ""}{roleLabel(s.roles)}</Chip>
                {admin && !s.admin && (
                  <form action={removeStaffMember}>
                    <input type="hidden" name="id" value={s.id} />
                    <PendingButton className="text-sm font-medium text-muted underline-offset-4 hover:underline" pending="Removing…">Remove</PendingButton>
                  </form>
                )}
              </div>
            </div>
          ))}
        </Card>
      </section>

      {admin ? (
        <section className="space-y-3">
          <Eyebrow>Invite staff</Eyebrow>
          <Card className="space-y-4 p-5">
            <form action={inviteStaff} className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="roles" className="mb-1 block text-sm font-medium">They will be</label>
                <select id="roles" name="roles" defaultValue="coach" className={input}>
                  <option value="coach">Coach</option>
                  <option value="scientist">Sports scientist</option>
                  <option value="both">Coach and sports scientist</option>
                </select>
              </div>
              <PendingButton className={btn} pending="Creating…">Create invite link</PendingButton>
            </form>
            <p className="text-xs text-muted">Each link works once and expires after {STAFF_INVITE_DAYS} days. Send it to the person directly. They choose their own password.</p>
            {invites.length > 0 && (
              <div className="divide-y divide-line rounded-md border border-line">
                {invites.map((i) => (
                  <div key={i.token} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span>{roleLabel(i.roles)} <span className="text-xs text-muted">· created {ago(i.created_at)}</span></span>
                    <div className="flex items-center gap-2">
                      <CopyButton path={`/join/staff/${i.token}`} label="Copy link" className={btnGhost} />
                      <form action={revokeStaffInvite}>
                        <input type="hidden" name="token" value={i.token} />
                        <PendingButton className="px-2 text-sm font-medium text-muted underline-offset-4 hover:underline" pending="Revoking…">Revoke</PendingButton>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>
      ) : (
        <p className="text-sm text-muted">Only the club admin can invite or remove staff.</p>
      )}

      {admin && (
        <section className="space-y-3">
          <Eyebrow>Delete this club</Eyebrow>
          <Card className="space-y-3 border-bad/30 p-5">
            {typeof deleteerr === "string" && <p className="rounded-md border border-bad/30 bg-bad-bg p-3 text-sm text-bad">{deleteerr}</p>}
            <p className="max-w-2xl text-sm text-muted">This permanently deletes {clubName}: every player and all their answers, the program, suggestions, staff accounts and invites. Connected wearables are disconnected. It cannot be undone and we keep no copy. If you want a copy of anything first, take it now.</p>
            <form action={deleteWholeClub} className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="del-name" className="block text-sm font-medium">Type the club name to confirm</label>
                <input id="del-name" name="name" autoComplete="off" required className={`${input} mt-1`} placeholder={clubName} />
              </div>
              <PendingButton className={btnGhost} pending="Deleting…">Delete the club and everything in it</PendingButton>
            </form>
          </Card>
        </section>
      )}
    </div>
  );
}
