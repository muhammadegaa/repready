import Link from "next/link";
import { LeadForm } from "@/components/LeadForm";
import { Beats } from "@/components/landing/Beats";

// Three beats, one field. The detail lives on /trust, where it can be read once and checked.
const LIMITS = ["Never above the plan", "Cuts at most 25%", "A person decides pain and illness"];

export default function Landing() {
  return (
    <div className="space-y-14 pb-16 pt-4">
      <h1 className="sr-only">RepReady: players check in, the agent adjusts, you approve</h1>
      <Beats />

      <section id="pilot" className="flex flex-wrap items-center justify-between gap-5">
        <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted">For football performance staff</div>
        <LeadForm id="hero" />
      </section>

      <section className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-line pt-6 text-sm text-muted">
        <ul className="flex flex-wrap gap-x-6 gap-y-1.5 font-mono text-xs uppercase tracking-[0.1em]">
          {LIMITS.map((l) => <li key={l}>{l}</li>)}
        </ul>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
          <Link href="/trust" className="underline underline-offset-4 hover:text-ink">What it never does</Link>
          <Link href="/signup" className="underline underline-offset-4 hover:text-ink">Create a club account</Link>
        </div>
      </section>
    </div>
  );
}
