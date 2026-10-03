import type { Ask, AskOpts } from "./model";

// Players' names never reach the model. Every known player name (the full name and each part of it) is replaced with a code before
// the call, and the codes are put back in whatever comes out. It is plain code, so it cannot be talked out of it.
const LETTER = "\\p{L}\\p{N}";
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type Redactor = { redact: (text: string) => string; restore: <T>(value: T) => T };

export function makeRedactor(names: string[]): Redactor {
  const parts = new Set<string>();
  for (const full of names) {
    const clean = full.trim().replace(/\s+/g, " ");
    if (clean.length >= 2) parts.add(clean);
    for (const p of clean.split(" ")) if (p.replace(/[^\p{L}]/gu, "").length >= 3) parts.add(p);
  }
  // Longest first, so "Jo Mensah" is replaced whole before "Mensah" on its own.
  const ordered = [...parts].sort((a, b) => b.length - a.length);
  const code = new Map(ordered.map((n, i) => [n, `[N${i + 1}]`]));
  const back = new Map([...code].map(([n, c]) => [c, n]));
  const patterns = ordered.map((n) => ({ re: new RegExp(`(?<![${LETTER}])${esc(n)}(?![${LETTER}])`, "giu"), c: code.get(n)! }));

  const redact = (text: string) => patterns.reduce((t, { re, c }) => t.replace(re, c), text);
  const restoreStr = (s: string) => s.replace(/\[N\d+\]/g, (c) => back.get(c) ?? c);
  const restore = <T,>(v: T): T => {
    if (typeof v === "string") return restoreStr(v) as T;
    if (Array.isArray(v)) return v.map((x) => restore(x)) as T;
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, restore(x)])) as T;
    return v;
  };
  return { redact, restore };
}

export function withRedaction(ask: Ask, names: string[]): Ask {
  const r = makeRedactor(names);
  return (async <T,>(opts: AskOpts<T>) => r.restore(await ask({ ...opts, system: r.redact(opts.system), user: r.redact(opts.user) }))) as Ask;
}
