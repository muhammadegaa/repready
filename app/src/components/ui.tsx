import type { ReactNode } from "react";

export const btn =
  "inline-flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-sm transition hover:bg-brand-strong disabled:opacity-50";
export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-4 py-2 text-sm font-medium transition hover:bg-paper disabled:opacity-50";
export const input =
  "w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm placeholder:text-muted";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-surface ${className}`}>{children}</div>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{children}</h2>;
}

const TONES = {
  neutral: "border-line bg-paper text-muted",
  ok: "border-transparent bg-ok-bg text-ok",
  warn: "border-transparent bg-warn-bg text-warn",
  bad: "border-transparent bg-bad-bg text-bad",
  marker: "border-transparent bg-marker text-marker-ink",
} as const;
export type Tone = keyof typeof TONES;

export function Chip({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

// The highlighter: used only where a value was changed.
export function Mark({ children }: { children: ReactNode }) {
  return <mark className="rounded-[3px] bg-marker px-1 font-mono text-marker-ink">{children}</mark>;
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "warn" }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${tone === "warn" ? "text-warn" : ""}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Notice({ children, tone = "warn" }: { children: ReactNode; tone?: "warn" | "bad" | "ok" }) {
  const t = { warn: "border-warn/30 bg-warn-bg text-warn", bad: "border-bad/30 bg-bad-bg text-bad", ok: "border-ok/30 bg-ok-bg text-ok" }[tone];
  return <div className={`rounded-lg border px-4 py-3 text-sm ${t}`}>{children}</div>;
}
