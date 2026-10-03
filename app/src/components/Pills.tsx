// A row of radio pills for a whole-number scale. Works without JavaScript.
export function Pills({
  name, from, to, defaultValue, required = true, labelFrom, labelTo,
}: { name: string; from: number; to: number; defaultValue?: number | null; required?: boolean; labelFrom?: string; labelTo?: string }) {
  const values = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <label key={v} className="cursor-pointer">
            <input type="radio" name={name} value={v} defaultChecked={defaultValue === v} required={required} className="peer sr-only" />
            <span className="flex h-10 min-w-10 items-center justify-center rounded-md border border-line-strong bg-surface px-2 font-mono text-sm tabular-nums transition peer-checked:border-brand peer-checked:bg-brand peer-checked:text-on-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand">
              {v}
            </span>
          </label>
        ))}
      </div>
      {(labelFrom || labelTo) && (
        <div className="mt-1 flex justify-between text-[11px] text-muted"><span>{labelFrom}</span><span>{labelTo}</span></div>
      )}
    </div>
  );
}
