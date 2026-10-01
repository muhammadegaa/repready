import Link from "next/link";
import { LeadForm } from "@/components/LeadForm";
import { SessionTable } from "@/components/SessionTable";
import { btn, btnGhost, Card, Chip, Eyebrow } from "@/components/ui";

const sample = [
  { name: "Back squat", sets: 4, reps: 5, load: "85% 1RM", target_rpe: 8 },
  { name: "Romanian deadlift", sets: 3, reps: 8, load: "70% 1RM", target_rpe: 7 },
  { name: "Nordic hamstring curl", sets: 3, reps: 5, load: "Bodyweight", target_rpe: 8 },
];
const edits = [
  { kind: "set_reps" as const, exercise: "Romanian deadlift", to: 7 },
  { kind: "set_reps" as const, exercise: "Nordic hamstring curl", to: 4 },
];

const steps = [
  ["Players check in", "Sleep, soreness and stress on their phone, plus session RPE after training. A Polar device can supply the sleep."],
  ["The agent proposes one change", "It reads the last 14 days, applies one of ten rules, and names the rule it used."],
  ["Your staff decide", "Approve, change the numbers, or keep the plan. The player sees only what you send."],
];

const control = [
  "Never raises sets, reps or load above the plan",
  "Cuts at most 25% unless your staff cut more",
  "Pain and illness notes are flagged, never edited around",
  "Rules are fixed and each proposal names its rule",
  "Data stored in London. Players can delete their own data",
];

const faqs = [
  ["Does it replace the coach?", "No. Nothing reaches a player until a member of staff approves it."],
  ["Who sets the rules?", "A fixed set of ten rules, edited by your sports scientist with a citation on each. The agent is scored against their own decisions on 30 test players before you rely on it. That review has not been done yet."],
  ["Which devices work?", "Polar sleep and HRV sync is built and in testing. Other devices are not connected. Without a device, players type their sleep."],
  ["What about academy players?", "Players aged 18 and over only, for now."],
];

export default function Landing() {
  return (
    <div className="space-y-24 pb-20">
      <section className="grid items-center gap-12 pt-4 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <Eyebrow>For football performance staff</Eyebrow>
          <h1 className="mt-4 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[52px]">
            Adjust each player’s session from their daily check-in.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
            Players fill in sleep, soreness and stress on their phone. RepReady proposes one change to the planned session, with the reason. Your staff approve it before the player sees anything.
          </p>
          <div id="pilot" className="mt-8 space-y-2">
            <LeadForm id="hero" />
            <p className="text-sm text-muted">We use your details only to reply to this request.</p>
          </div>
        </div>

        <div>
          <Card className="overflow-hidden shadow-[0_1px_0_var(--line),0_24px_60px_-30px_rgb(0_0_0/0.35)]">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <div>
                <div className="text-sm font-semibold leading-tight">Centre-back</div>
                <div className="text-xs text-muted">Lower body, two days before match</div>
              </div>
              <Chip tone="warn">Needs approval</Chip>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div>
                <div className="font-semibold tracking-tight">Reduce today’s volume</div>
                <p className="mt-0.5 text-sm leading-relaxed">Slept 5.5 h and 5.4 h on the last two nights, so reps drop by one on two lifts.</p>
              </div>
              <SessionTable planned={sample} edits={edits} />
              <div className="flex items-center gap-2 text-xs text-muted"><span className="rounded bg-paper px-1.5 py-0.5 font-mono ring-1 ring-line">R1</span>Short sleep, two nights</div>
            </div>
            <div className="flex items-center gap-2 border-t border-line bg-paper px-5 py-3">
              <span className={`${btn} pointer-events-none`}>Approve</span>
              <span className={`${btnGhost} pointer-events-none`}>Keep the plan</span>
            </div>
          </Card>
          <p className="mt-3 text-center text-xs text-muted">Example. Highlighted values are the changes.</p>
        </div>
      </section>

      <section className="space-y-6">
        <Eyebrow>How it works</Eyebrow>
        <ol className="grid gap-5 md:grid-cols-3">
          {steps.map(([t, b], i) => (
            <li key={t} className="space-y-2 border-t border-ink pt-4">
              <span className="font-mono text-xs text-muted">0{i + 1}</span>
              <h3 className="font-semibold tracking-tight">{t}</h3>
              <p className="text-sm leading-relaxed text-muted">{b}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-10 md:grid-cols-2">
        <div className="space-y-4">
          <Eyebrow>Control</Eyebrow>
          <ul className="space-y-2.5">
            {control.map((c) => <li key={c} className="flex gap-3 text-[15px] leading-relaxed"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-sm bg-marker ring-1 ring-ink/70" />{c}</li>)}
          </ul>
        </div>
        <div className="space-y-4">
          <Eyebrow>Questions</Eyebrow>
          <dl className="space-y-5">
            {faqs.map(([q, a]) => (
              <div key={q}>
                <dt className="font-semibold tracking-tight">{q}</dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-muted">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="rounded-2xl bg-ink px-6 py-10 text-paper sm:px-12">
        <h2 className="max-w-xl text-2xl font-semibold tracking-tight">Run a pilot with your squad</h2>
        <div className="mt-6 max-w-xl [&_input]:border-paper/30 [&_input]:bg-paper [&_input]:text-ink [&_button]:bg-marker [&_button]:text-marker-ink">
          <LeadForm id="final" />
        </div>
        <p className="mt-5 text-sm text-paper/60">Already have an account? <Link href="/signin" className="underline underline-offset-4">Sign in</Link>.</p>
      </section>
    </div>
  );
}
