import Link from "next/link";
import { loadSample } from "@/actions/coach";
import { PendingButton } from "./Pending";
import { btnGhost, Card, Chip, Eyebrow } from "./ui";

export type SetupState = { players: number; waiting: number; sessions: number; agreed: number; checkedIn: number };

type Step = { title: string; how: string; href: string; cta: string; done: boolean };

export function setupSteps(s: SetupState): Step[] {
  return [
    {
      title: "Add your players",
      how: "Paste your squad or upload a spreadsheet (I read it, you check it), add them one by one, or post the squad link in your team chat and let players add themselves.",
      href: "/coach/squad", cta: "Open Squad", done: s.players + s.waiting > 0,
    },
    {
      title: "Import your program",
      how: "Paste your week as you wrote it, or upload your spreadsheet. I read it, you check it, and nothing reaches players until you say so.",
      href: "/coach/program", cta: "Open Program", done: s.sessions > 0,
    },
    {
      title: "Get each player onto their own phone",
      how: "Send each player their personal link, or share the squad link. They agree to the terms once, on the phone they will use every morning.",
      href: "/coach/squad", cta: "Send links", done: s.agreed > 0,
    },
    {
      title: "Receive the first check-in",
      how: "When a player checks in, the rules read it. Anything that needs you appears at the top of this page. You approve, change or keep the plan.",
      href: "/coach", cta: "Wait for it here", done: s.checkedIn > 0,
    },
  ];
}

export function GetStarted({ name, state, hasSample = false }: { name: string; state: SetupState; hasSample?: boolean }) {
  const steps = setupSteps(state);
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const next = steps.findIndex((s) => !s.done);
  return (
    <Card className="space-y-4 p-5" aria-label="Getting started">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Eyebrow>Getting started</Eyebrow>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{done === 0 ? `Welcome, ${name.split(" ")[0]}. Four steps and your squad is live.` : `${done} of ${steps.length} done`}</h2>
        </div>
        <span className="font-mono text-xs text-muted">{done}/{steps.length}</span>
      </div>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s.title} className={`flex gap-3 rounded-lg border px-4 py-3 ${i === next ? "border-ink bg-surface" : "border-line"}`}>
            <span aria-hidden className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${s.done ? "bg-ok text-paper" : "border border-line-strong text-muted"}`}>{s.done ? "✓" : i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`font-medium ${s.done ? "text-muted line-through" : ""}`}>{s.title}</span>
                {s.done && <Chip tone="ok">Done</Chip>}
              </div>
              {!s.done && <p className="mt-1 text-sm text-muted">{s.how}</p>}
              {i === next && <Link href={s.href} className="mt-2 inline-block text-sm font-medium underline underline-offset-4">{s.cta} →</Link>}
            </div>
          </li>
        ))}
      </ol>
      {!hasSample && (
        <form action={loadSample} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-line-strong p-4">
          <div className="max-w-xl text-sm">
            <div className="font-medium">Want to see it working first?</div>
            <p className="mt-0.5 text-muted">Load a sample squad: six fictional players with two weeks of answers, two groups, a plan change, and today&apos;s suggestions. It is labelled as sample and removed in one click. Your own players and program are never touched.</p>
          </div>
          <PendingButton className={btnGhost} pending="Loading…">Load a sample squad</PendingButton>
        </form>
      )}
      <p className="text-xs text-muted">Optional, any time: add match dates in Program, and invite a sports scientist or another coach in Staff.</p>
    </Card>
  );
}
