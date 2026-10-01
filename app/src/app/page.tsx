const PRODUCT = "RepReady";
const PAYMENT_LINK = process.env.NEXT_PUBLIC_PAYMENT_LINK;

const steps = [
  { title: "Your plan stays yours", body: "Import the program you already wrote. Nothing changes until you approve it." },
  { title: "Athletes check in", body: "Session RPE, sleep, soreness and stress, in under a minute from a link on their phone." },
  { title: "The agent proposes edits", body: "For each athlete it suggests specific changes to today's session and gives the reason, citing their own numbers." },
  { title: "You decide", body: "Approve, edit or reject. The athlete sees the session you approved." },
];

const limits = [
  "Never raises sets, reps or load above your plan.",
  "Never cuts volume or load by more than 25%.",
  "Does not edit around pain or illness notes. It flags them to you.",
  "Gives no medical advice and makes no claim about preventing injury.",
  "Adult athletes only for now.",
];

const faqs = [
  {
    q: "What data does it use?",
    a: "Check-ins your athletes enter: session RPE, hours slept, soreness and stress. Wearable sync is planned and is not live yet.",
  },
  {
    q: "Who decides the adjustment rules?",
    a: "A sports scientist with a PhD (University of Salford) writes and reviews the rule set. The agent can only apply rules from that set, and every proposal names the rule it used.",
  },
  {
    q: "Is athlete health data safe?",
    a: "Sleep and soreness are health data. Athletes give explicit consent before their first check-in, and we will publish what we store and why before launch. We are finishing the data protection assessment before real athlete data goes in.",
  },
  {
    q: "What does a founding place include?",
    a: "Up to 50 athletes and unlimited coaches. You start a 30-day free trial with a card, are charged £79 a month after it, and can cancel before the first charge.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 sm:px-6">
      <header className="pt-10 sm:pt-16">
        <p className="font-mono text-xs uppercase tracking-wider text-teal-700 dark:text-teal-400">{PRODUCT} · for S&C coaches</p>
        <h1 className="mt-3 text-balance text-3xl font-semibold leading-tight sm:text-5xl">
          Adjust today&apos;s session to how each athlete is today.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-neutral-600 dark:text-neutral-400">
          Athletes check in. {PRODUCT} proposes edits to your planned session, with the reason. You approve every change.
        </p>
        <div className="mt-6">
          {PAYMENT_LINK ? (
            <a
              href={PAYMENT_LINK}
              className="inline-block rounded-md bg-teal-700 px-5 py-3 font-medium text-white hover:bg-teal-800 dark:bg-teal-500 dark:text-neutral-950 dark:hover:bg-teal-400"
            >
              Reserve a founding place, 30 days free
            </a>
          ) : (
            <span className="inline-block rounded-md border border-neutral-300 px-5 py-3 text-neutral-500 dark:border-neutral-700">
              Payment link not set
            </span>
          )}
          <p className="mt-2 text-sm text-neutral-500">
            Up to 50 athletes, unlimited coaches. Card required, nothing charged for 30 days, then £79 a month. Cancel any time before the first charge.
          </p>
        </div>
      </header>

      <section className="mt-16">
        <h2 className="text-xl font-semibold">How it works</h2>
        <ol className="mt-4 grid gap-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <span className="font-mono text-sm text-teal-700 dark:text-teal-400">{i + 1}</span>
              <div>
                <h3 className="font-medium">{s.title}</h3>
                <p className="mt-1 text-neutral-600 dark:text-neutral-400">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16">
        <h2 className="text-xl font-semibold">What it will not do</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-neutral-700 dark:text-neutral-300">
          {limits.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>

      <section className="mt-16">
        <h2 className="text-xl font-semibold">Questions</h2>
        <dl className="mt-4 space-y-5">
          {faqs.map((f) => (
            <div key={f.q}>
              <dt className="font-medium">{f.q}</dt>
              <dd className="mt-1 text-neutral-600 dark:text-neutral-400">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
