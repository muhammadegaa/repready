import Link from "next/link";
import { LeadForm } from "@/components/LeadForm";
import { SessionTable } from "@/components/SessionTable";
import { btn, btnGhost, Card, Chip, Eyebrow } from "@/components/ui";

const PAYMENT_LINK = process.env.NEXT_PUBLIC_PAYMENT_LINK;
// The card checkout only shows once it is switched live, so nobody is sent to a test-mode page.
const CHECKOUT_LIVE = process.env.NEXT_PUBLIC_CHECKOUT_LIVE === "1" && Boolean(PAYMENT_LINK);

const sample = [
  { name: "Back squat", sets: 4, reps: 5, load: "85% 1RM", target_rpe: 8 },
  { name: "Romanian deadlift", sets: 3, reps: 8, load: "70% 1RM", target_rpe: 7 },
  { name: "Split squat", sets: 3, reps: 8, load: "RPE 7", target_rpe: 7 },
];
const edits = [
  { kind: "set_reps" as const, exercise: "Romanian deadlift", to: 7 },
  { kind: "set_reps" as const, exercise: "Split squat", to: 7 },
];

const steps = [
  ["Import your program", "Paste it as a CSV: date, session, exercise, sets, reps, load, target RPE. Nothing changes until you approve an edit."],
  ["Athletes check in", "Sleep hours, soreness 0 to 10, stress 0 to 10 and an optional note, from a link in their phone browser. A connected Polar device fills in the sleep."],
  ["The agent proposes an edit", "It reads the last 14 days and applies one of ten rules. The proposal lists the exercises it would change and the rule it used."],
  ["You decide", "Approve it, change the numbers, or keep your plan. The athlete sees the session you sent, with changed values highlighted."],
];

const proposal = [
  "The decision: reduce volume, swap an exercise, rest, or check with the athlete before training",
  "The session with old and new values for every change",
  "The rule used, with its trigger in plain words",
  "What the agent saw: sleep, soreness, stress, device HRV and heart rate, and the athlete's note",
  "A flag if something needs your judgement, such as a pain note",
];

const views = [
  { who: "Coach", points: ["Today: who has checked in, who needs a decision", "Approve, approve with changed numbers, or keep your plan", "Add a note the athlete sees with the session", "Mark an exercise as protected so the agent never edits it", "A 14-day view of sleep, soreness, stress and effort per athlete"] },
  { who: "Athlete", points: ["Consent screen before the first check-in", "Three questions and an optional note", "Today's session with changes highlighted", "Effort log (1 to 10) after training", "Delete their own data from their page"] },
  { who: "Sports scientist", points: ["Edit each rule and attach its citation", "Label 30 test athletes with the decision you would make", "Run the agent against those labels", "See agreement against the pass bar"] },
];

const limits = [
  "Never raises sets, reps or load above your plan.",
  "Cuts volume or load by at most 25%. You can cut more yourself.",
  "Does not edit exercises when a note mentions pain or illness. It flags the note to you.",
  "No medical advice and no claims about preventing injury.",
  "Adult athletes only.",
];

const faqs = [
  ["What does the athlete have to do?", "Open a link on their phone and answer three questions. There is no app to install. After training they can log how hard the session felt."],
  ["What if I disagree with a proposal?", "Change the numbers, add a note, or keep your plan. Nothing reaches the athlete until you send it."],
  ["Who decides the rules?", "The agent can only apply the ten rules in the rule set. A sports scientist edits them and adds a citation to each. At the moment none of the ten has been reviewed and the agent has no evaluation score yet."],
  ["Which devices work?", "Polar sleep and HRV sync is built and in testing. WHOOP, Garmin, Oura and Fitbit are not connected, and neither is Apple Watch. Without a device, athletes type their sleep."],
  ["Where is the data stored?", "In London (Google Cloud europe-west2). Athletes consent before their first check-in and can delete their own data at any time. Sleep and soreness are health data. A data protection assessment is not finished, so the pilot is not open to real athletes yet."],
  ["What does the founding price include?", "Up to 50 athletes and unlimited coaches on one shared program. It is free for 30 days, then £79 a month. Cancel before the first charge and you pay nothing."],
];

function Access({ id }: { id: string }) {
  return (
    <div id={id} className="space-y-3">
      {CHECKOUT_LIVE ? (
        <div className="space-y-2">
          <a href={PAYMENT_LINK} className={`${btn} px-6 py-3 text-base`}>Start 30 days free</a>
          <p className="text-sm text-muted">Card required. £79 a month after 30 days. Cancel before you are charged and you pay nothing.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <LeadForm id={id} cta="Join the waitlist" />
          <p className="text-sm text-muted">No card. We use your email only to tell you when your place opens. Founding price: £79 a month after 30 days free.</p>
        </div>
      )}
    </div>
  );
}

export default function Landing() {
  return (
    <div className="space-y-28 pb-24">
      <section className="grid items-center gap-12 pt-4 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <Eyebrow>For strength and conditioning coaches</Eyebrow>
          <h1 className="mt-4 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[56px]">
            Adjust today’s session for each athlete, using their check-in.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
            Athletes answer three questions on their phone. RepReady proposes one change to the session you wrote and names the rule behind it. You approve, edit or reject it, and the athlete sees only what you send.
          </p>
          <div className="mt-8"><Access id="hero" /></div>
          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            {["Never raises load above your plan", "Cuts at most 25%", "Data stored in London"].map((t) => (
              <li key={t} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-sm bg-marker ring-1 ring-ink/70" />{t}</li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <Card className="overflow-hidden shadow-[0_1px_0_var(--line),0_24px_60px_-30px_rgb(0_0_0/0.35)]">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-semibold text-paper">M</span>
                <div><div className="text-sm font-semibold leading-tight">Maya</div><div className="text-xs text-muted">Lower strength</div></div>
              </div>
              <Chip tone="warn">Needs you</Chip>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div>
                <div className="font-semibold tracking-tight">Reduce today’s volume</div>
                <p className="mt-0.5 text-sm leading-relaxed">Slept 5.5 h and 5.4 h on the last two nights, so reps drop by one on the two accessory lifts.</p>
              </div>
              <SessionTable planned={sample} edits={edits} />
              <div className="flex items-center gap-2 text-xs text-muted"><span className="rounded bg-paper px-1.5 py-0.5 font-mono ring-1 ring-line">R1</span>Short sleep, two nights</div>
            </div>
            <div className="flex items-center gap-2 border-t border-line bg-paper px-5 py-3">
              <span className={`${btn} pointer-events-none`}>Approve</span>
              <span className={`${btnGhost} pointer-events-none`}>Keep my plan</span>
            </div>
          </Card>
          <p className="mt-3 text-center text-xs text-muted">Example proposal. Highlighted values are the changes.</p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl space-y-4">
        <Eyebrow>The problem</Eyebrow>
        <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight">A weekly program does not see this morning’s check-in.</h2>
        <p className="text-lg leading-relaxed text-muted">
          Sleep, soreness and stress change daily, and adjusting each athlete by hand takes time. RepReady reads the check-ins and lists the athletes who need a decision.
        </p>
      </section>

      <section className="space-y-6">
        <Eyebrow>How it works</Eyebrow>
        <ol className="grid gap-5 md:grid-cols-4">
          {steps.map(([t, b], i) => (
            <li key={t} className="space-y-2 border-t border-ink pt-4">
              <span className="font-mono text-xs text-muted">0{i + 1}</span>
              <h3 className="font-semibold tracking-tight">{t}</h3>
              <p className="text-sm leading-relaxed text-muted">{b}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid items-center gap-10 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Eyebrow>What a proposal contains</Eyebrow>
          <ul className="space-y-2.5">
            {proposal.map((p) => <li key={p} className="flex gap-3 text-[15px] leading-relaxed"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-sm bg-marker ring-1 ring-ink/70" />{p}</li>)}
          </ul>
          <h2 className="pt-4 text-xl font-semibold tracking-tight">What the athlete sees</h2>
          <p className="max-w-xl text-[15px] leading-relaxed text-muted">
            Today’s session with your changes highlighted, your note if you wrote one, and a box to log how hard it felt. The page updates when you approve, within a few seconds, without a reload.
          </p>
        </div>
        <div className="mx-auto w-full max-w-[300px] rounded-[2rem] border border-line-strong bg-paper p-3 shadow-[0_24px_60px_-30px_rgb(0_0_0/0.35)]">
          <div className="space-y-3 rounded-[1.4rem] border border-line bg-surface p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Thu 1 Oct</div>
            <div className="text-xl font-semibold leading-tight tracking-tight">Lower strength</div>
            <div className="rounded-lg border border-line bg-paper p-3 text-sm">
              <Chip tone="marker">From your coach</Chip>
              <p className="mt-2 font-medium">Your coach adjusted today’s session.</p>
              <p className="mt-1 text-muted">“Rough week. Take the lighter version.”</p>
            </div>
            <SessionTable planned={sample} edits={edits} />
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <Eyebrow>Who uses it</Eyebrow>
        <div className="grid gap-4 md:grid-cols-3">
          {views.map((v) => (
            <Card key={v.who} className="p-5">
              <h3 className="font-semibold tracking-tight">{v.who}</h3>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
                {v.points.map((p) => <li key={p} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink" />{p}</li>)}
              </ul>
            </Card>
          ))}
        </div>
        <p className="text-sm text-muted">The three screens share one record. A change on one shows on the others within a few seconds.</p>
      </section>

      <section className="grid gap-10 md:grid-cols-2">
        <div className="space-y-4">
          <Eyebrow>Limits</Eyebrow>
          <ul className="space-y-2.5">
            {limits.map((l) => <li key={l} className="flex gap-3 text-[15px] leading-relaxed"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-sm bg-marker ring-1 ring-ink/70" />{l}</li>)}
          </ul>
        </div>
        <div className="space-y-4">
          <Eyebrow>Rules</Eyebrow>
          <p className="text-[15px] leading-relaxed text-muted">
            The agent can only apply the ten rules in a fixed set, and every proposal names the rule it used. A sports scientist edits the rules and cites a source for each. The agent is then scored against that scientist’s own decisions on 30 test athletes. The pass bar is 80% agreement overall and 100% on the cases where the right call is no change.
          </p>
          <Chip tone="warn">Status: review in progress, no score yet</Chip>
        </div>
      </section>

      <section className="mx-auto w-full max-w-xl">
        <Card className="space-y-4 p-7">
          <Eyebrow>Founding price</Eyebrow>
          <div className="flex items-baseline gap-2"><span className="text-5xl font-semibold tracking-tight">£79</span><span className="text-muted">a month</span></div>
          <ul className="space-y-1.5 text-sm text-muted">
            <li>Free for the first 30 days</li>
            <li>Up to 50 athletes, unlimited coaches, one shared program</li>
            <li>Cancel before the first charge and you pay nothing</li>
          </ul>
          <Access id="pricing" />
        </Card>
      </section>

      <section className="space-y-6">
        <Eyebrow>Questions</Eyebrow>
        <dl className="grid gap-x-12 gap-y-7 md:grid-cols-2">
          {faqs.map(([q, a]) => (
            <div key={q}>
              <dt className="font-semibold tracking-tight">{q}</dt>
              <dd className="mt-1.5 text-[15px] leading-relaxed text-muted">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-2xl bg-ink px-6 py-12 text-center text-paper sm:px-12">
        <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold leading-tight tracking-tight">Join the waitlist for a founding place</h2>
        <p className="mx-auto mt-3 max-w-xl text-paper/70">£79 a month after 30 days free. Up to 50 athletes.</p>
        <div className="mx-auto mt-8 flex max-w-md justify-center [&_input]:border-paper/30 [&_input]:bg-paper [&_input]:text-ink [&_button]:bg-marker [&_button]:text-marker-ink [&_p]:text-paper/70">
          <Access id="final" />
        </div>
        <p className="mt-6 text-sm text-paper/60">Athletes use the link their coach sends. Coaches can <Link href="/signin" className="underline underline-offset-4">sign in</Link>.</p>
      </section>
    </div>
  );
}
