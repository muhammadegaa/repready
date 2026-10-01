export function Steps({ steps, active, warn = false }: { steps: string[]; active: number; warn?: boolean }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {steps.map((s, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <li key={s} className="flex flex-1 items-center gap-2" aria-current={current ? "step" : undefined}>
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                done ? "border-ink bg-ink text-paper" : current ? (warn ? "border-warn bg-warn-bg text-warn" : "border-ink bg-marker text-marker-ink") : "border-line-strong text-muted"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={`text-xs leading-tight ${current ? "font-medium" : "text-muted"}`}>{s}</span>
            {i < steps.length - 1 && <span className="h-px flex-1 bg-line-strong" />}
          </li>
        );
      })}
    </ol>
  );
}
