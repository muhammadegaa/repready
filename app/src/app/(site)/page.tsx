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
  ["Your plan stays yours", "Paste the program you already wrote. Nothing changes until you approve it."],
  ["Athletes check in", "Sleep, soreness and stress from a link on their phone, in under a minute. A Polar device fills in the sleep for them."],
  ["You get a proposal", "One change to today’s session, the reason in plain words, and the rule it came from."],
  ["You decide", "Approve it, change the numbers, or keep your plan. The athlete sees only what you send."],
];

const compare = [
  ["Shows you the numbers", "Yes, you collect and read them", "Yes", "Yes"],
  ["Proposes the edit to the session", "No", "Usually left to you", "Yes, one specific edit"],
  ["You approve before the athlete sees it", "Not applicable", "Not applicable", "Always"],
  ["Tells you which rule it used", "No", "Rarely", "Every proposal"],
  ["Hard limits it cannot cross", "No", "No", "Never raises load, never cuts over 25%"],
];

const views = [
  { who: "Coach", points: ["Today: who needs you and who is on plan", "The proposal as a session diff, with the rule behind it", "Edit the numbers or add a note before it goes out", "Protect an exercise the agent must never touch"] },
  { who: "Athlete", points: ["A one-minute check-in on a phone", "Today’s session with the changes highlighted", "Effort log after training", "Delete their own data in one tap"] },
  { who: "Sports scientist", points: ["Edit each rule and attach its citation", "Label scenarios with the call they would make", "Run the agent against those labels", "See agreement against a pass bar"] },
];

const limits = [
  "Never raises sets, reps or load above your plan.",
  "Never cuts volume or load by more than 25%. You can cut deeper yourself.",
  "Does not edit around pain or illness. It flags them to you.",
  "No medical advice, and no claim about preventing injury.",
  "Adult athletes only.",
];

const faqs = [
  ["What does the athlete have to do?", "Open a link on their phone and answer three quick questions. No app to install. If they connect a Polar device, the sleep is filled in for them."],
  ["What if I disagree with a proposal?", "Change the numbers yourself, add a note, or keep your plan. Nothing reaches the athlete until you send it."],
  ["Who decides the rules?", "A fixed rule set, and the agent can only apply those rules. Each rule is being reviewed and cited by a sports scientist, and the scientist’s view shows how often the agent agrees with their own calls on thirty test athletes."],
  ["Which devices work?", "Polar is the first live integration. WHOOP, Garmin, Oura and Fitbit are planned. Apple Watch is not connected yet. Without a device, athletes type their sleep."],
  ["Is athlete health data safe?", "Sleep and soreness are health data. Athletes consent before the first check-in and can delete their own data at any time. Storage is in the UK. A data protection assessment is being finished before any real athlete data is stored."],
  ["What does a founding place include?", "Up to 50 athletes and unlimited coaches on the same program. 30 days free, then £79 a month. Cancel before the first charge and you pay nothing."],
];

function Access({ id, dark = false }: { id: string; dark?: boolean }) {
  return (
    <div id={id} className={dark ? "space-y-3" : "space-y-3"}>
      {CHECKOUT_LIVE ? (
        <div className="space-y-2">
          <a href={PAYMENT_LINK} className={`${btn} px-6 py-3 text-base`}>Start 30 days free</a>
          <p className="text-sm text-muted">Card required. £79 a month after 30 days. Cancel before you are charged and you pay nothing.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <LeadForm id={id} />
          <p className="text-sm text-muted">No card needed. We email you when your founding place opens. £79 a month after 30 days free.</p>
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
            Adjust today’s session to how each athlete actually is.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
            Athletes check in on their phone. RepReady suggests one specific change to the session you wrote, with the reason. You approve it in a tap, and only then does the athlete see it.
          </p>
          <div className="mt-8"><Access id="hero" /></div>
          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            {["You approve every change", "Never cuts more than 25%", "Data stored in the UK"].map((t) => (
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
                <p className="mt-0.5 text-sm leading-relaxed">Slept 5.5 h and 5.4 h the last two nights (Polar), so reps drop by one on the two accessory lifts.</p>
              </div>
              <SessionTable planned={sample} edits={edits} />
              <div className="flex items-center gap-2 text-xs text-muted"><span className="rounded bg-paper px-1.5 py-0.5 font-mono ring-1 ring-line">R1</span>Short sleep, two nights</div>
            </div>
            <div className="flex items-center gap-2 border-t border-line bg-paper px-5 py-3">
              <span className={`${btn} pointer-events-none`}>Approve</span>
              <span className={`${btnGhost} pointer-events-none`}>Keep my plan</span>
            </div>
          </Card>
          <p className="mt-3 text-center text-xs text-muted">Example proposal. Highlighted values are what changed.</p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl space-y-5 text-center">
        <Eyebrow>The problem</Eyebrow>
        <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">The plan was right on Sunday.</h2>
        <p className="text-lg leading-relaxed text-muted">
          By Wednesday your prop slept five hours, your winger’s hamstrings are tight, and the plan still says 4 × 5 at 85%. You can rewrite thirty sessions by hand every morning, or run the plan as written and hope. RepReady reads the check-ins for you and puts the few edits that matter in front of you.
        </p>
      </section>

      <section className="space-y-6">
        <Eyebrow>How a morning works</Eyebrow>
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
          <Eyebrow>What the athlete sees</Eyebrow>
          <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight">Only what you decided to send.</h2>
          <p className="max-w-xl text-lg leading-relaxed text-muted">
            The athlete never sees a raw suggestion. They see today’s session with your changes highlighted, your note if you wrote one, and a way to log how hard it felt. When you approve, their phone updates by itself.
          </p>
        </div>
        <div className="mx-auto w-full max-w-[300px] rounded-[2rem] border border-line-strong bg-paper p-3 shadow-[0_24px_60px_-30px_rgb(0_0_0/0.35)]">
          <div className="space-y-3 rounded-[1.4rem] border border-line bg-surface p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Thu 1 Oct</div>
            <div className="text-xl font-semibold leading-tight tracking-tight">Lower strength</div>
            <div className="rounded-lg border border-line bg-paper p-3 text-sm">
              <Chip tone="marker">From your coach</Chip>
              <p className="mt-2 font-medium">Your coach adjusted today’s session.</p>
              <p className="mt-1 text-muted">“Rough week, I know. Take the lighter version.”</p>
            </div>
            <SessionTable planned={sample} edits={edits} />
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <Eyebrow>Not another dashboard</Eyebrow>
          <h2 className="mt-3 max-w-2xl text-balance text-3xl font-semibold leading-tight tracking-tight">Numbers are easy to collect. The edit is the work.</h2>
        </div>
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-left font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                <th className="px-4 py-3 font-medium" />
                <th className="px-4 py-3 font-medium">Forms and spreadsheets</th>
                <th className="px-4 py-3 font-medium">Monitoring dashboards</th>
                <th className="bg-marker px-4 py-3 font-medium text-marker-ink">RepReady</th>
              </tr>
            </thead>
            <tbody>
              {compare.map(([k, a, b, c]) => (
                <tr key={k} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium">{k}</td>
                  <td className="px-4 py-3 text-muted">{a}</td>
                  <td className="px-4 py-3 text-muted">{b}</td>
                  <td className="px-4 py-3 font-medium">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <Eyebrow>Three views, one record</Eyebrow>
          <p className="mt-3 max-w-2xl text-lg text-muted">When an athlete checks in, your screen updates. When you decide, their phone updates. No refresh, no message to chase.</p>
        </div>
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
      </section>

      <section className="grid gap-10 md:grid-cols-2">
        <div className="space-y-4">
          <Eyebrow>What it will not do</Eyebrow>
          <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight">You stay the coach.</h2>
          <ul className="space-y-2.5">
            {limits.map((l) => <li key={l} className="flex gap-3 text-[15px] leading-relaxed"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-sm bg-marker ring-1 ring-ink/70" />{l}</li>)}
          </ul>
        </div>
        <div className="space-y-4">
          <Eyebrow>Rules you can inspect</Eyebrow>
          <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight">Every proposal names its rule.</h2>
          <p className="text-[15px] leading-relaxed text-muted">The agent can only apply the rules in a fixed set. A sports scientist edits each rule and attaches its citation, and the agent is scored against that scientist’s own decisions on thirty test athletes before you rely on it.</p>
          <Chip tone="warn">Pilot: rule review in progress</Chip>
        </div>
      </section>

      <section className="mx-auto w-full max-w-xl">
        <Card className="space-y-4 p-7">
          <Eyebrow>Founding place</Eyebrow>
          <div className="flex items-baseline gap-2"><span className="text-5xl font-semibold tracking-tight">£79</span><span className="text-muted">a month</span></div>
          <ul className="space-y-1.5 text-sm text-muted">
            <li>30 days free</li>
            <li>Up to 50 athletes, unlimited coaches, one program</li>
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
        <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Stop running the Sunday plan on a Wednesday body.</h2>
        <p className="mx-auto mt-3 max-w-xl text-paper/70">Get a founding place and shape what gets built next.</p>
        <div className="mx-auto mt-8 flex max-w-md justify-center [&_input]:border-paper/30 [&_input]:bg-paper [&_input]:text-ink [&_button]:bg-marker [&_button]:text-marker-ink [&_p]:text-paper/70">
          <Access id="final" dark />
        </div>
        <p className="mt-6 text-sm text-paper/60">Already have a link from your coach? Athletes use that link. Coaches can <Link href="/signin" className="underline underline-offset-4">sign in</Link>.</p>
      </section>
    </div>
  );
}
