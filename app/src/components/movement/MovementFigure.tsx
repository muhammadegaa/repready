"use client";

import { useEffect, useRef, useState } from "react";
import { interpolate, phaseAt } from "@/lib/movement/pose";
import type { Movement, Pose } from "@/lib/movement/types";

const HOLD_MS = 700;
const SPEEDS = [{ v: 1, label: "1×" }, { v: 0.5, label: "½×" }, { v: 0.25, label: "¼×" }];

const line = (p: Pose, names: (keyof Pose)[], dx = 0) => "M" + names.map((n) => `${(p[n][0] + dx).toFixed(1)} ${p[n][1].toFixed(1)}`).join(" L");

function Body({ pose }: { pose: Pose }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={line(pose, ["hip", "knee", "ankle", "toe"], -9)} stroke="var(--ink)" strokeWidth={6} opacity={0.35} />
      <path d={line(pose, ["neck", "elbow", "wrist"], -7)} stroke="var(--ink)" strokeWidth={5} opacity={0.35} />
      <path d={line(pose, ["neck", "hip"])} stroke="var(--brand)" strokeWidth={10} />
      <path d={line(pose, ["hip", "knee", "ankle", "toe"])} stroke="var(--ink)" strokeWidth={7} />
      <path d={line(pose, ["neck", "elbow", "wrist"])} stroke="var(--ink)" strokeWidth={6} />
      <circle cx={pose.head[0]} cy={pose.head[1]} r={15} fill="var(--paper)" stroke="var(--ink)" strokeWidth={5} />
    </g>
  );
}

function Stage({ scene, children, className, label }: { scene: Movement["scene"]; children: React.ReactNode; className?: string; label?: string }) {
  return (
    <svg viewBox={`0 20 ${scene.width} ${scene.height - 40}`} className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <line x1={14} y1={scene.ground} x2={scene.width - 14} y2={scene.ground} stroke="var(--line-strong)" strokeWidth={2} />
      {scene.box && <rect x={scene.box.x} y={scene.box.y} width={scene.box.w} height={scene.ground - scene.box.y} rx={4} fill="var(--brand-soft)" stroke="var(--line-strong)" strokeWidth={2} />}
      {scene.pad && <rect x={scene.pad.x} y={scene.pad.y} width={scene.pad.w} height={scene.ground - scene.pad.y} rx={4} fill="var(--line-strong)" />}
      {children}
    </svg>
  );
}

// An exercise as a slow, repeatable side view. Plays on its own unless the person asked for reduced motion, which starts it paused.
// Play, pause, slow motion, scrub, and a row of the key poses to jump to. The phase being shown is named as it happens.
export function MovementFigure({ movement: m }: { movement: Movement }) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(() => typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [speed, setSpeed] = useState(1);
  const elapsed = useRef(0);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let prev = performance.now();
    const cycle = m.durationMs + HOLD_MS;
    const tick = (now: number) => {
      elapsed.current = (elapsed.current + (now - prev) * speed) % cycle;
      prev = now;
      setT(Math.min(1, elapsed.current / m.durationMs));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, m.durationMs]);

  const seek = (v: number) => { setPlaying(false); elapsed.current = v * m.durationMs; setT(v); };
  const phase = phaseAt(m.phases, t);
  // The last keyframe repeats the one before it (a hold), so it is not shown twice.
  const key = m.keyframes.filter((k, i, a) => i === 0 || JSON.stringify(k.pose) !== JSON.stringify(a[i - 1].pose));

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border border-line bg-surface">
        <Stage scene={m.scene} className="block w-full" label={`${m.name}, side view. Phases: ${m.phases.map((p) => p.label).join(", ")}.`}>
          <Body pose={interpolate(m.keyframes, t)} />
        </Stage>
        <div className="pointer-events-none absolute left-3 top-3 font-mono text-xs uppercase tracking-[0.14em] text-brand" aria-hidden>{phase}</div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setPlaying((p) => !p)} className="inline-flex h-10 min-w-[4.5rem] items-center justify-center rounded-md border border-line-strong bg-surface px-3 text-sm font-medium transition active:scale-[0.98]">{playing ? "Pause" : "Play"}</button>
        <div className="flex gap-1" role="group" aria-label="Speed">
          {SPEEDS.map((s) => (
            <button key={s.v} type="button" aria-pressed={speed === s.v} onClick={() => setSpeed(s.v)} className={`h-10 min-w-10 rounded-md border px-2.5 text-sm font-medium transition active:scale-[0.98] ${speed === s.v ? "border-brand bg-brand-soft text-brand-ink" : "border-line-strong bg-surface"}`}>{s.label}</button>
          ))}
        </div>
        <input type="range" min={0} max={1} step={0.001} value={t} onChange={(e) => seek(Number(e.target.value))} aria-label="Position in the movement" aria-valuetext={phase} className="h-10 min-w-0 flex-1 accent-[var(--brand)]" />
      </div>

      <ol className="grid grid-cols-6 gap-1.5" aria-label="Key positions">
        {key.map((k, i) => (
          <li key={i}>
            <button type="button" onClick={() => seek(k.t)} aria-label={`Go to ${phaseAt(m.phases, k.t)}, position ${i + 1} of ${key.length}`} className="block w-full rounded-md border border-line bg-surface p-0.5 transition hover:border-brand/50 active:scale-[0.97]">
              <Stage scene={m.scene} className="block w-full"><Body pose={k.pose} /></Stage>
            </button>
          </li>
        ))}
      </ol>

      <ul className="list-disc space-y-0.5 pl-5 text-sm">{m.cues.map((c) => <li key={c}>{c}</li>)}</ul>
      {!m.reviewed && <p className="text-xs text-muted">This guide is waiting for a sports scientist to check it.</p>}
    </div>
  );
}

// Two library pictures of the same exercise that fade into each other, for the exercises we have no figure for.
export function StillsFade({ src, name }: { src: string; name: string }) {
  return (
    <div className="frames relative mx-auto aspect-[4/3] w-full max-w-sm overflow-hidden rounded-xl border border-line bg-paper">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`${name}, start position`} className="absolute inset-0 h-full w-full object-contain" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${src}?f=1`} alt={`${name}, end position`} className="frames-b absolute inset-0 h-full w-full object-contain" />
    </div>
  );
}
