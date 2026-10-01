"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Polls a one-document pulse and re-renders the page when it changes, so the coach, athlete and
// scientist views stay in step. Slows down when the person is idle and stops when the tab is hidden.
export function Live({ scope, initial, label = "Live" }: { scope: string; initial: number; label?: string }) {
  const router = useRouter();
  const seen = useRef(initial);
  const [state, setState] = useState<"live" | "paused" | "offline">("live");

  useEffect(() => {
    seen.current = initial;
  }, [initial]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let lastActive = Date.now();
    const bump = () => { lastActive = Date.now(); };
    const events = ["pointerdown", "keydown", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    const tick = async () => {
      if (stopped) return;
      if (document.hidden) {
        setState("paused");
        timer = setTimeout(tick, 8000);
        return;
      }
      try {
        const res = await fetch(`/api/pulse?scope=${encodeURIComponent(scope)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const { at } = (await res.json()) as { at: number };
        setState("live");
        if (at !== seen.current) {
          seen.current = at;
          router.refresh();
        }
      } catch {
        setState("offline");
      }
      timer = setTimeout(tick, Date.now() - lastActive > 120_000 ? 15_000 : 3_000);
    };

    const onVisible = () => {
      if (!document.hidden) {
        clearTimeout(timer);
        void tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    timer = setTimeout(tick, 3_000);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      events.forEach((e) => window.removeEventListener(e, bump));
    };
  }, [scope, router]);

  const dot = state === "live" ? "bg-ok pulse-dot" : state === "paused" ? "bg-muted" : "bg-bad";
  const text = state === "live" ? label : state === "paused" ? "Paused" : "Reconnecting";
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted" aria-live="polite">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {text}
    </span>
  );
}
