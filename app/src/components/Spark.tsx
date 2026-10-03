// Seven days of sleep as bars. Missing days are a flat tick.
export function Spark({ values, max = 10 }: { values: (number | null)[]; max?: number }) {
  return (
    <span className="inline-flex h-6 items-end gap-[3px]" role="img" aria-label={`Sleep, last ${values.length} days: ${values.map((v) => v ?? "none").join(", ")}`}>
      {values.map((v, i) => (
        <span
          key={i}
          className={`w-[5px] rounded-[1px] ${v === null ? "bg-line" : v < 6 ? "bg-bad" : "bg-brand/60"}`}
          style={{ height: v === null ? 3 : Math.max(3, Math.round((Math.min(v, max) / max) * 24)) }}
        />
      ))}
    </span>
  );
}
