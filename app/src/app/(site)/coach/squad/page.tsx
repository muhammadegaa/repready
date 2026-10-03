import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { addPlayer, addPlayers, confirmPlayer, loadSample, removeAthlete, removeSample, resetPlayerLink, setGroupForMany } from "@/actions/coach";
import { rotateSquadLink } from "@/actions/club";
import { CopyButton } from "@/components/CopyButton";
import { Live } from "@/components/Live";
import { PendingButton } from "@/components/Pending";
import { btn, btnGhost, Card, Chip, Eyebrow, input, Notice } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { groupLabel, groupNames } from "@/lib/groups";
import { inviteMessage, POSITIONS, squadMessage } from "@/lib/squad";
import { getNotice, getPulse, listAthletes, squadInvite, type AthleteRow } from "@/lib/store";

export const metadata = { title: "Squad" };
export const dynamic = "force-dynamic";

function status(a: AthleteRow): { label: string; tone: "neutral" | "warn" | "ok" } {
  if (!a.consented_at) return { label: "Not agreed yet", tone: "neutral" };
  if (!a.device_token) return { label: "Agreed, no phone yet", tone: "warn" };
  return { label: "On their phone", tone: "ok" };
}

export default async function Squad(props: PageProps<"/coach/squad">) {
  const { club, clubName, admin } = await requirePage("coach");
  const { added, grouped, grouperr } = await props.searchParams;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const [all, notice, pastedList, pulse, joinToken] = await Promise.all([listAthletes(club), getNotice(club, "squad"), getNotice(club, "squad_list"), getPulse(club, "coach"), squadInvite(club)]);
  const waiting = all.filter((p) => !p.approved);
  const players = all.filter((p) => p.approved);
  const joinPath = `/join/${joinToken}`;
  const joinQr = await QRCode.toString(`${origin}${joinPath}`, { type: "svg", margin: 1, width: 168 });
  const sorted = [...players].sort((a, b) => a.squad.localeCompare(b.squad) || (a.shirt ?? 999) - (b.shirt ?? 999) || a.name.localeCompare(b.name));
  const qr = new Map(await Promise.all(sorted.map(async (p) => [p.code, await QRCode.toString(`${origin}/a/${p.code}`, { type: "svg", margin: 1, width: 168 })] as const)));
  const joined = players.filter((p) => p.device_token).length;
  const sampleCount = all.filter((p) => p.sample).length;

  return (
    <div className="space-y-8">
      <Live scope="coach" initial={pulse} />
      <header>
        <Link href="/coach" className="text-sm text-muted hover:text-ink">← Today</Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Squad</h1>
        <p className="mt-1 text-muted">{players.length} player{players.length === 1 ? "" : "s"}, {joined} on their own phone. Each personal link works on one phone: the first phone to agree to the terms keeps it.</p>
      </header>

      {typeof added === "string" && added && (
        <Notice tone="ok">
          {/^\d+$/.test(added) ? `Added ${added} players.` : `Added ${added}.`} They are listed under <a href="#players" className="font-medium underline underline-offset-4">Players and links</a>. Send each their link, or share the squad link.
        </Notice>
      )}

      {typeof grouped === "string" && grouped && <Notice tone="ok">{grouped}</Notice>}
      {typeof grouperr === "string" && grouperr && <Notice tone="bad">{grouperr}</Notice>}

      <Card className="space-y-3 p-5">
        <Eyebrow>Squad link</Eyebrow>
        <p className="max-w-2xl text-sm text-muted">One link for the whole squad. Post it in the team group chat. Each player adds their own name, shirt number and position on their phone, then you confirm them below before they can check in.</p>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton path={joinPath} label="Copy squad link" className={btn} />
          <a href={`https://wa.me/?text=${encodeURIComponent(squadMessage(clubName, `${origin}${joinPath}`))}`} target="_blank" rel="noreferrer" className={btnGhost}>Send on WhatsApp</a>
          <details className="rounded-md border border-line-strong bg-surface">
            <summary className="disclosure cursor-pointer px-3 py-2 text-sm font-medium">QR code</summary>
            <div className="border-t border-line p-3" dangerouslySetInnerHTML={{ __html: joinQr }} />
          </details>
          {admin && (
            <form action={rotateSquadLink}><PendingButton className="px-2 text-sm font-medium text-muted underline-offset-4 hover:underline" pending="Replacing…">Replace link</PendingButton></form>
          )}
        </div>
        {admin && <p className="text-xs text-muted">Replacing the link stops the old one working. Players already added are not affected.</p>}
      </Card>

      {waiting.length > 0 && (
        <section className="space-y-3">
          <Eyebrow>Waiting for you · {waiting.length}</Eyebrow>
          <Card className="divide-y divide-line">
            {waiting.map((p) => (
              <div key={p.code} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="font-medium">
                  {p.shirt ? <span className="mr-2 font-mono text-muted">{p.shirt}</span> : null}{p.name}
                  <span className="ml-2 text-xs font-normal text-muted">{[p.position, p.squad].filter(Boolean).join(" · ")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <form action={confirmPlayer}><input type="hidden" name="code" value={p.code} /><PendingButton className={btn} pending="Confirming…">Confirm player</PendingButton></form>
                  <form action={removeAthlete}><input type="hidden" name="code" value={p.code} /><input type="hidden" name="confirm" value="yes" /><PendingButton className={btnGhost} pending="Removing…">Not in the squad</PendingButton></form>
                </div>
              </div>
            ))}
          </Card>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-5">
          <Eyebrow>Add a player</Eyebrow>
          <form action={addPlayer} className="space-y-3">
            <div className="grid grid-cols-[1fr_5rem] gap-2">
              <div><label htmlFor="p-name" className="sr-only">Name</label><input id="p-name" name="name" placeholder="Name" required maxLength={80} className={input} /></div>
              <div><label htmlFor="p-shirt" className="sr-only">Shirt number</label><input id="p-shirt" name="shirt" type="number" min={1} max={99} placeholder="No." className={input} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="p-pos" className="sr-only">Position</label>
                <select id="p-pos" name="position" defaultValue="" className={input}><option value="">Position</option>{POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
              </div>
              <div><label htmlFor="p-squad" className="sr-only">Squad</label><input id="p-squad" name="squad" defaultValue="First team" maxLength={30} className={input} /></div>
            </div>
            <PendingButton className={btn} pending="Adding…">Add player</PendingButton>
          </form>
        </Card>

        <Card className="space-y-3 p-5">
          <Eyebrow>Add a whole squad</Eyebrow>
          {notice && <pre className="whitespace-pre-wrap rounded-md border border-bad/30 bg-bad-bg p-3 text-sm text-bad">{notice}</pre>}
          <form action={addPlayers} className="space-y-3">
            <label htmlFor="list" className="block text-sm text-muted">One player per line: name, shirt number, position, squad. Paste straight from a spreadsheet. Only the name is needed.</label>
            <textarea id="list" name="list" rows={5} defaultValue={notice ? pastedList ?? "" : ""} placeholder={"J. Mensah, 5, Centre-back\nL. Ortiz, 9, Forward, U21"} className={`${input} font-mono text-[13px]`} />
            <PendingButton className={btnGhost} pending="Adding…">Add players</PendingButton>
          </form>
        </Card>
      </section>

      <Card className="space-y-3 p-5">
        <Eyebrow>Sample squad</Eyebrow>
        {sampleCount > 0 ? (
          <>
            <p className="max-w-2xl text-sm text-muted">{sampleCount} fictional players are mixed into this squad, marked Sample. Use <b>Try as this player</b> on any of them to see exactly what a player sees on their phone, and check in as them. Removing them takes the sample players, their answers, suggestions and plan changes, and the sample program. Your own players and program stay.</p>
            <form action={removeSample} className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" required />Remove the sample squad</label>
              <PendingButton className={btnGhost} pending="Removing…">Remove sample squad</PendingButton>
            </form>
          </>
        ) : (
          <>
            <p className="max-w-2xl text-sm text-muted">Six fictional players with two weeks of answers, two groups, a plan change and today&apos;s suggestions, so you can see every screen working. They are labelled Sample and removed in one click. Your own players and program are never touched.</p>
            <form action={loadSample}><PendingButton className={btnGhost} pending="Loading…">Load a sample squad</PendingButton></form>
          </>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <Eyebrow>Groups</Eyebrow>
        <p className="max-w-2xl text-sm text-muted">Split the squad when players need different work, for example starters and reserves, or players returning from injury. A group can have its own version of a session in the Program. Tick players below, name a group, and press Set group. Leave the name empty, or type Everyone, to take them out of a group.</p>
        <div className="flex flex-wrap gap-1.5">
          {[null, ...groupNames(players)].map((g) => (
            <Chip key={g ?? "everyone"} tone={g ? "marker" : "neutral"}>{groupLabel(g)} · {players.filter((p) => (p.group ?? null) === g).length}</Chip>
          ))}
        </div>
        <form id="groupform" action={setGroupForMany} className="flex flex-wrap items-center gap-2">
          <label htmlFor="group" className="sr-only">Group name</label>
          <input id="group" name="group" list="group-names" maxLength={30} placeholder="Group name, e.g. Reserves" className={`${input} max-w-64`} />
          <datalist id="group-names">{groupNames(players).map((g) => <option key={g} value={g} />)}</datalist>
          <PendingButton className={btn} pending="Setting…">Set group for ticked players</PendingButton>
        </form>
      </Card>

      <section id="players" className="space-y-3">
        <Eyebrow>Players and links</Eyebrow>
        {sorted.length === 0 ? (
          <Card className="px-5 py-6 text-sm text-muted">No players yet. Add one above, or paste the squad.</Card>
        ) : (
          <Card className="divide-y divide-line">
            {sorted.map((p) => {
              const st = status(p);
              const url = `${origin}/a/${p.code}`;
              const wa = `https://wa.me/?text=${encodeURIComponent(inviteMessage(p.name, url))}`;
              return (
                <div key={p.code} className="space-y-3 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <input type="checkbox" form="groupform" name="code" value={p.code} aria-label={`Select ${p.name}`} className="h-4 w-4" />
                      <div className="font-medium">
                        {p.shirt ? <span className="mr-2 font-mono text-muted">{p.shirt}</span> : null}{p.name}
                        <span className="ml-2 text-xs font-normal text-muted">{[p.position, p.squad].filter(Boolean).join(" · ")}</span>
                        {p.group ? <span className="ml-2 align-middle"><Chip tone="marker">{p.group}</Chip></span> : null}{p.sample ? <span className="ml-2 align-middle"><Chip tone="warn">Sample</Chip></span> : null}
                      </div>
                    </div>
                    <Chip tone={st.tone}>{st.label}</Chip>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CopyButton path={`/a/${p.code}`} label="Copy link" className={btnGhost} />
                    <a href={wa} target="_blank" rel="noreferrer" className={btnGhost}>Send on WhatsApp</a>
                    <details className="rounded-md border border-line-strong bg-surface">
                      <summary className="disclosure cursor-pointer px-3 py-2 text-sm font-medium">QR code</summary>
                      <div className="border-t border-line p-3" dangerouslySetInnerHTML={{ __html: qr.get(p.code) ?? "" }} />
                    </details>
                    <Link href={`/coach/athletes/${p.code}`} className="px-2 text-sm font-medium text-muted underline-offset-4 hover:underline">Open</Link>
                    {p.sample && <a href={`/a/${p.code}`} target="_blank" rel="noreferrer" className="px-2 text-sm font-medium underline underline-offset-4">Try as this player</a>}
                  </div>
                  <details className="text-sm">
                    <summary className="disclosure cursor-pointer text-muted hover:text-ink">Link and removal</summary>
                    <div className="mt-3 flex flex-wrap items-start gap-6">
                      <form action={resetPlayerLink} className="space-y-1">
                        <input type="hidden" name="code" value={p.code} />
                        <PendingButton className={btnGhost} pending="Resetting…">Reset link</PendingButton>
                        <p className="max-w-xs text-xs text-muted">Use this when a player changes phone or the link was shared. The old phone loses access.</p>
                      </form>
                      <form action={removeAthlete} className="space-y-2">
                        <input type="hidden" name="code" value={p.code} />
                        <label className="flex items-center gap-2"><input type="checkbox" name="confirm" value="yes" required />Delete {p.name} and all their data. This cannot be undone.</label>
                        <PendingButton className={btnGhost} pending="Deleting…">Delete player</PendingButton>
                      </form>
                    </div>
                  </details>
                </div>
              );
            })}
          </Card>
        )}
      </section>
    </div>
  );
}
