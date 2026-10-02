import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { addPlayer, addPlayers, removeAthlete, resetPlayerLink } from "@/actions/coach";
import { CopyButton } from "@/components/CopyButton";
import { Live } from "@/components/Live";
import { PendingButton } from "@/components/Pending";
import { btn, btnGhost, Card, Chip, Eyebrow, input } from "@/components/ui";
import { getRole } from "@/lib/auth";
import { inviteMessage, POSITIONS } from "@/lib/squad";
import { getNotice, getPulse, listAthletes, type AthleteRow } from "@/lib/store";

export const metadata = { title: "Squad" };
export const dynamic = "force-dynamic";

function status(a: AthleteRow): { label: string; tone: "neutral" | "warn" | "ok" } {
  if (!a.consented_at) return { label: "Not agreed yet", tone: "neutral" };
  if (!a.device_token) return { label: "Agreed, no phone yet", tone: "warn" };
  return { label: "On their phone", tone: "ok" };
}

export default async function Squad() {
  if ((await getRole()) !== "coach") redirect("/signin");
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const [players, notice, pulse] = await Promise.all([listAthletes(), getNotice("squad"), getPulse("coach")]);
  const sorted = [...players].sort((a, b) => a.squad.localeCompare(b.squad) || (a.shirt ?? 999) - (b.shirt ?? 999) || a.name.localeCompare(b.name));
  const qr = new Map(await Promise.all(sorted.map(async (p) => [p.code, await QRCode.toString(`${origin}/a/${p.code}`, { type: "svg", margin: 1, width: 168 })] as const)));
  const joined = players.filter((p) => p.device_token).length;

  return (
    <div className="space-y-8">
      <Live scope="coach" initial={pulse} />
      <header>
        <Link href="/coach" className="text-sm text-muted hover:text-ink">← Today</Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Squad</h1>
        <p className="mt-1 text-muted">{players.length} player{players.length === 1 ? "" : "s"}, {joined} on their own phone. Each link works on one phone: the first phone to agree to the terms keeps it.</p>
      </header>

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
            <textarea id="list" name="list" rows={5} placeholder={"J. Mensah, 5, Centre-back\nL. Ortiz, 9, Forward, U21"} className={`${input} font-mono text-[13px]`} />
            <PendingButton className={btnGhost} pending="Adding…">Add players</PendingButton>
          </form>
        </Card>
      </section>

      <section className="space-y-3">
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
                    <div className="min-w-0">
                      <div className="font-medium">
                        {p.shirt ? <span className="mr-2 font-mono text-muted">{p.shirt}</span> : null}{p.name}
                        <span className="ml-2 text-xs font-normal text-muted">{[p.position, p.squad].filter(Boolean).join(" · ")}</span>
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
