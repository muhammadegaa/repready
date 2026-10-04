import { notFound } from "next/navigation";
import { Card, Chip, Eyebrow } from "@/components/ui";
import { getSession, isPlatformAdmin } from "@/lib/auth";
import { milestones, signals, stageOf } from "@/lib/pilot";
import { allClubFacts } from "@/lib/pilot-data";
import { countLeads, listLeads } from "@/lib/store";

export const metadata = { title: "Pilot health" };
export const dynamic = "force-dynamic";

export default async function Admin() {
  const s = await getSession();
  if (!s || !isPlatformAdmin(s.email)) notFound();
  const [clubs, leads, leadCount] = await Promise.all([allClubFacts(), listLeads(10), countLeads()]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Pilot health</h1>
        <p className="mt-1 max-w-2xl text-muted">Every club at a glance: how far it has got, and what to look at. For whoever runs the pilot. Clubs never see this.</p>
      </header>

      {clubs.length === 0 ? (
        <Card className="px-5 py-6 text-sm text-muted">No clubs yet.</Card>
      ) : (
        <div className="space-y-4">
          {clubs.map((c) => {
            const ms = milestones(c);
            const flags = signals(c);
            return (
              <Card key={c.id} className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">{c.name} <span className="font-mono text-xs font-normal text-muted">{c.id}</span></div>
                    <div className="text-sm text-muted">Day {c.daysOld + 1} · {c.players} player{c.players === 1 ? "" : "s"}, {c.consented} agreed · {c.sessions} session{c.sessions === 1 ? "" : "s"} · {c.checkins7} check-ins in 7 days · {c.decided7} of {c.proposals7} suggestions decided</div>
                  </div>
                  <Chip tone={c.paid ? "ok" : "neutral"}>{c.paid ? "Subscribed" : "Not subscribed"}</Chip>
                </div>
                <ol className="grid gap-2 sm:grid-cols-4">
                  {ms.map((m, i) => (
                    <li key={m.key} className={`rounded-md border px-3 py-2 text-sm ${m.done ? "border-ok/30 bg-ok-bg text-ok" : "border-line bg-paper text-muted"}`}>
                      <span className="font-mono text-xs">{i + 1}</span> {m.done ? "✓ " : ""}{m.label}
                    </li>
                  ))}
                </ol>
                <p className="text-sm"><b>Next:</b> {stageOf(c)}</p>
                {flags.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-sm text-warn">{flags.map((f) => <li key={f}>{f}</li>)}</ul>}
              </Card>
            );
          })}
        </div>
      )}

      <section className="space-y-3">
        <Eyebrow>Waitlist · {leadCount}</Eyebrow>
        <Card className="divide-y divide-line">
          {leads.length === 0 ? <div className="px-5 py-4 text-sm text-muted">Nobody yet.</div> : leads.map((l) => (
            <div key={l.id} className="flex flex-wrap justify-between gap-2 px-5 py-2.5 text-sm"><span>{l.email}{l.club ? <span className="text-muted"> · {l.club}</span> : null}</span><span className="text-xs text-muted">{l.created_at.slice(0, 10)}</span></div>
          ))}
        </Card>
      </section>
    </div>
  );
}
