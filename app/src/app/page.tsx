const PRODUCT = "RepReady";
const PAYMENT_LINK = process.env.NEXT_PUBLIC_PAYMENT_LINK;

const steps = [
  { title: "Your plan stays yours", body: "Import the program you already wrote. Nothing changes until you approve it." },
  { title: "Athletes check in", body: "Sleep, soreness and stress, from a link on their phone. A wearable can fill in the sleep." },
  { title: "You get a proposal", body: "One change to today's session, the reason, and the rule it came from." },
  { title: "You decide", body: "Approve or reject. The athlete sees only the session you kept." },
];

const limits = [
  "Never raises sets, reps or load above your plan.",
  "Never cuts volume or load by more than 25%.",
  "Does not edit around pain or illness. It flags them to you.",
  "No medical advice, and no claim about preventing injury.",
  "Adult athletes only.",
];

const proofs = [
  "You approve every change",
  "Rules written by a Salford PhD",
  "Volume stays within 25% of your plan",
];

const faqs = [
  {
    q: "What data does it use?",
    a: "What the athlete reports, plus sleep, HRV and resting heart rate when a wearable is connected. WHOOP, Garmin, Oura, Fitbit and Polar share one login. Apple Watch is not connected yet.",
  },
  {
    q: "Who decides the adjustment rules?",
    a: "A sports scientist with a PhD from the University of Salford writes the rule set. The agent can only apply those rules, and every proposal names the one it used.",
  },
  {
    q: "Is athlete health data safe?",
    a: "Sleep and soreness are health data. Athletes consent before the first check-in. A data protection assessment is being finished before any real athlete data is stored.",
  },
  {
    q: "What does a founding place include?",
    a: "Up to 50 athletes and unlimited coaches. Card required. Nothing is charged for 30 days, then £79 a month. Cancel before the first charge.",
  },
];

const cta = "inline-flex items-center justify-center rounded-md bg-accent px-5 py-3 text-sm font-medium text-[#f4f2ec] hover:opacity-90 dark:text-[#111210]";

export default function Home() {
  return (
    <main className="pb-20">
      <header className="pt-12 sm:pt-20">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">{PRODUCT} · for S&C coaches</p>
        <h1 className="mt-4 max-w-2xl text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          Adjust today&apos;s session to how each athlete actually is.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
          Athletes check in. {PRODUCT} proposes a specific edit to the session you wrote, and says why. Nothing reaches the athlete until you approve it.
        </p>
        <div className="mt-8 flex flex-col items-start gap-3">
          {PAYMENT_LINK ? (
            <a href={PAYMENT_LINK} className={cta}>Reserve a founding place</a>
          ) : (
            <span className="inline-flex rounded-md border border-line px-5 py-3 text-sm text-muted">Payment link not set</span>
          )}
          <p className="text-sm text-muted">£79 a month after 30 days free · up to 50 athletes · cancel before you are charged</p>
        </div>
        <ul className="mt-10 flex flex-col gap-2 border-t border-line pt-6 text-sm sm:flex-row sm:gap-8">
          {proofs.map((p) => (
            <li key={p} className="text-muted">{p}</li>
          ))}
        </ul>
      </header>

      <section className="mt-16">
        <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted">How a morning works</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-lg border border-line bg-card p-4">
              <p className="font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-2 font-medium">{s.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16 grid gap-10 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted">What it will not do</h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed">
            {limits.map((l) => (
              <li key={l} className="border-t border-line pt-3">{l}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-line bg-card p-5">
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted">Founding place</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">£79<span className="text-base font-normal text-muted"> / month</span></p>
          <p className="mt-2 text-sm leading-relaxed text-muted">Up to 50 athletes. Unlimited coaches on the same program. 30 days free, then the card you left is charged.</p>
          {PAYMENT_LINK && (
            <a href={PAYMENT_LINK} className={`${cta} mt-5`}>Start the 30 days</a>
          )}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted">Questions</h2>
        <dl className="mt-4 divide-y divide-line border-y border-line">
          {faqs.map((f) => (
            <div key={f.q} className="py-4">
              <dt className="font-medium">{f.q}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
