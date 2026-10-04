import Link from "next/link";
import { Card, Eyebrow } from "@/components/ui";

export const metadata = { title: "What RepReady does and never does" };

const DOES = [
  "Reads each player’s morning check-in: sleep, soreness, stress, any note, how hard sessions felt.",
  "Compares it with written rules and with that player’s own usual, not with the squad.",
  "Proposes at most one change to that player’s planned session, with the rule that fired and the numbers it saw.",
  "Prepares the routine work for the coach: next week’s draft, fixtures from the club calendar, a squad map.",
];
const NEVER = [
  "Raises sets, reps or load above the plan.",
  "Cuts more than a quarter of the volume unless a member of staff chooses to.",
  "Edits around a pain or illness note. Those stop everything and go to the coach.",
  "Diagnoses, treats or gives medical advice.",
  "Changes a player’s session without the coach’s say-so. The one exception is a rule the coach has chosen to hand over, and only after it has earned that.",
  "Sends a player’s check-in, notes or name to an outside AI service.",
];

export default function Trust() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-3">
        <Eyebrow>Plain terms</Eyebrow>
        <h1 className="text-4xl font-semibold tracking-tight">What RepReady does, and what it never does</h1>
        <p className="text-lg text-muted">An agent that watches, prepares and suggests, inside limits that live in code, for a coach who decides.</p>
      </header>

      <section className="grid gap-6 sm:grid-cols-2">
        <Card className="space-y-3 p-6">
          <h2 className="font-semibold text-brand-ink">It does</h2>
          <ul className="space-y-2 text-[15px] leading-relaxed">{DOES.map((t) => <li key={t} className="flex gap-2"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />{t}</li>)}</ul>
        </Card>
        <Card className="space-y-3 p-6">
          <h2 className="font-semibold text-bad">It never</h2>
          <ul className="space-y-2 text-[15px] leading-relaxed">{NEVER.map((t) => <li key={t} className="flex gap-2"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-bad" />{t}</li>)}</ul>
        </Card>
      </section>

      <section className="space-y-3">
        <Eyebrow>How much it does on its own</Eyebrow>
        <Card className="space-y-2 p-6 text-[15px] leading-relaxed">
          <p><b>It starts by only suggesting.</b> You approve or keep the plan. Routine trims can be approved together in one tap.</p>
          <p><b>It can take over a rule once that rule has earned it.</b> You choose which, and a rule only becomes available after it has had at least 8 of your decisions in 28 days with 9 in 10 approved exactly as proposed. Everything it does is listed for you each day with a button to take it back, and you can pause all of it, or mark any player “always ask me”.</p>
          <p><b>The limits do not move.</b> Pain, illness, “I can’t train today”, rest, swaps and anything the limits had to change always come to you.</p>
        </Card>
      </section>

      <section className="space-y-3">
        <Eyebrow>Where the data goes</Eyebrow>
        <Card className="space-y-2 p-6 text-[15px] leading-relaxed">
          <p><b>Check-ins and notes</b> are stored in a database in London and are seen by your club’s staff. A player sees only their own. Nothing is sold or shared.</p>
          <p><b>The rules run in our own code.</b> A language model is used in two places, both for the coach’s own words: reading the training program a coach pastes or uploads into a draft the coach checks, and reading a sentence typed into the Ask bar on Today so it can be matched to something the app already does. Before either call, every known player name is replaced with a code and put back afterwards. Check-ins, notes, proposals and health information are never sent, and answers in the Ask bar are written from stored data by our own code. Anything the Ask bar would change is shown first and saved only when the coach confirms.</p>
          <p><b>Players are 18 or over,</b> agree on their own phone before anything is stored, and can delete their data from their page at any time. A club admin can delete the whole club, and we keep no copy.</p>
        </Card>
      </section>

      <section className="space-y-3">
        <Eyebrow>What is not finished</Eyebrow>
        <Card className="space-y-2 p-6 text-[15px] leading-relaxed">
          <p>The rules are a starting set. A sports scientist has not yet reviewed them, and each one carries its reason so that your staff can. This is a pilot: it supports your judgement and does not replace it. It is not medical advice.</p>
        </Card>
      </section>

      <p className="text-sm text-muted">Questions? Ask the person who gave you your link, or <Link href="/" className="underline underline-offset-4">start at the front page</Link>.</p>
    </div>
  );
}
