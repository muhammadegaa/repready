"use client";

import { useEffect, useState } from "react";

// The squad as it looks at 08:00: 24 shirts, 18 have answered, three need the coach, six have not answered.
const SHIRTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];
const WAITING = new Set([11, 12, 17, 20, 23, 25]);
const NEEDS_YOU = new Set([3, 5, 8]);

const PLAY_MS = 14_000;
const OUT_MS = 500;

// Replays the morning every 14 seconds: fade out, remount (every animation restarts in step), play. It pauses while the tab is hidden
// and does not replay at all for people who ask for reduced motion, who see the finished state instead.
function useReplay() {
  const [cycle, setCycle] = useState(0);
  const [out, setOut] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let play: ReturnType<typeof setTimeout>, fade: ReturnType<typeof setTimeout>;
    const start = () => {
      play = setTimeout(() => {
        setOut(true);
        fade = setTimeout(() => { setCycle((c) => c + 1); setOut(false); start(); }, OUT_MS);
      }, PLAY_MS);
    };
    const onVisibility = () => {
      clearTimeout(play); clearTimeout(fade);
      if (document.visibilityState === "visible") { setOut(false); setCycle((c) => c + 1); start(); }
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { clearTimeout(play); clearTimeout(fade); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);
  return { cycle, out };
}

function Squad() {
  let order = 0;
  return (
    <div className="grid grid-cols-6 gap-1.5" aria-hidden>
      {SHIRTS.map((n) => {
        const kind = WAITING.has(n) ? "wait" : NEEDS_YOU.has(n) ? "need" : "in";
        const delay = kind === "wait" ? undefined : `${0.5 + order++ * 0.09}s`;
        return (
          <div key={n} className={`tile tile-${kind} flex h-11 items-center justify-between rounded-lg px-2.5`} style={delay ? ({ "--d": delay } as React.CSSProperties) : undefined}>
            <span className={`font-display text-xl ${kind === "wait" ? "text-muted/70" : "text-ink"}`}>{n}</span>
            <span className="tile-dot h-2 w-2 rounded-full" />
          </div>
        );
      })}
    </div>
  );
}

function Proposal() {
  return (
    <div className="b2-card flex flex-col gap-3" aria-hidden>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[17px] font-semibold">Mensah</span>
        <span className="rounded-full bg-warn-bg px-2.5 py-0.5 text-xs font-semibold text-warn">Needs you</span>
      </div>
      <div className="rounded-xl border border-line bg-surface p-3.5 font-mono text-sm leading-8">
        Romanian deadlift <s className="text-muted/70">3 × 8</s> <span className="chg chg-1 inline-block rounded px-1.5 font-semibold">3 × 7</span>
        <br />
        Nordic curl <s className="text-muted/70">3 × 5</s> <span className="chg chg-2 inline-block rounded px-1.5 font-semibold">3 × 4</span>
      </div>
      <div className="font-mono text-xs text-muted"><span className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-ink">R1</span> slept 5.5 h, 5.4 h</div>
    </div>
  );
}

function Approve() {
  return (
    <div className="flex flex-col items-start gap-3.5" aria-hidden>
      <div className="text-[17px] font-semibold">3 need you</div>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative h-12 w-32">
          <span className="ap-btn absolute inset-0 flex items-center justify-center rounded-[10px] bg-brand text-[15px] font-semibold text-on-brand">Approve</span>
          <span className="ap-sent absolute inset-0 flex items-center justify-center rounded-[10px] border border-brand text-[15px] font-semibold text-brand">Sent</span>
        </div>
        <span className="flex h-12 items-center rounded-[10px] border border-line-strong bg-surface px-5 text-[15px] font-medium">Keep the plan</span>
      </div>
      <div className="relative h-[18px] w-full font-mono text-xs">
        <span className="ap-note-a absolute left-0 top-0 text-muted">Nothing reaches a player until you do</span>
        <span className="ap-note-b absolute left-0 top-0 text-brand">Sent to 3 players. Logged</span>
      </div>
    </div>
  );
}

const BEATS = [
  { n: "01", title: "Players check in.", visual: <Squad />, alt: "Example: 18 of 24 players have checked in. Three need the coach." },
  { n: "02", title: "The agent adjusts.", visual: <Proposal />, alt: "Example: the agent proposes one less rep on two lifts for a centre-back who slept 5.5 and 5.4 hours." },
  { n: "03", title: "You approve.", visual: <Approve />, alt: "Example: the coach approves and the change goes to the players." },
];

export function Beats() {
  const { cycle, out } = useReplay();
  return (
    <div className={`beats ${out ? "beats-out" : ""}`}>
      <div key={cycle} className="grid gap-9 lg:grid-cols-3 lg:gap-7">
        {BEATS.map((b, i) => (
          <div key={b.n} className="beat-col flex min-w-0 flex-col gap-5" style={{ "--col": `${0.05 + i * 0.13}s` } as React.CSSProperties}>
            <span className="font-mono text-xs tracking-[0.14em] text-brand">{b.n}</span>
            <h2 className="font-display text-[44px] leading-none text-ink sm:text-5xl lg:text-[46px] xl:text-[48px]">{b.title}</h2>
            <div className="flex min-h-[250px] flex-col justify-center rounded-2xl border border-line bg-[#eef1e8] p-[18px]">
              {b.visual}
              <span className="sr-only">{b.alt}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
