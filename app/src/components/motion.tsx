"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// A number that counts to its new value when it changes while you are looking (a check-in arrives). It does not count on first load,
// so the page never shows a wrong number and then corrects it.
export function CountUp({ value, ms = 600 }: { value: number; ms?: number }) {
  const [moving, setMoving] = useState<number | null>(null); // the in-between number while it counts; null means show the real one
  const last = useRef(value);
  useEffect(() => {
    const a = last.current;
    last.current = value;
    if (a === value || reduced()) return;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      if (k < 1) { setMoving(Math.round(a + (value - a) * (1 - Math.pow(1 - k, 3)))); raf = requestAnimationFrame(step); }
      else setMoving(null);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <span className="tabular-nums">{moving ?? value}</span>;
}

// Wraps a card that is about to be decided: when its form is submitted it eases away instead of vanishing. If the card is still here a few
// seconds later (the decision was refused), it comes back.
export function LeaveOnSubmit({ children }: { children: ReactNode }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setLeaving(false), 4000);
    return () => clearTimeout(t);
  }, [leaving]);
  return <div className={leaving ? "leaving" : undefined} onSubmitCapture={() => setLeaving(true)}>{children}</div>;
}
