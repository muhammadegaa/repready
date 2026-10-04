"use client";

import { useRef, useState } from "react";
import type { Movement } from "@/lib/movement/types";
import { MovementFigure, StillsFade } from "./MovementFigure";

// A link under an exercise that opens a sheet showing how it is done: our own figure when we have one, otherwise the library's two pictures.
// The figure only exists while the sheet is open, so nothing animates unseen.
export function ShowMe({ name, movement, still }: { name: string; movement: Movement | null; still: string | null }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  if (!movement && !still) return null;
  return (
    <>
      <button type="button" onClick={() => { setOpen(true); ref.current?.showModal(); }} className="mt-0.5 block text-xs font-medium text-brand underline underline-offset-4">Show me</button>
      <dialog ref={ref} aria-label={`How to do ${name}`} onClose={() => setOpen(false)} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }} className="sheet">
        {open && (
          <div className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold tracking-tight">{movement?.name ?? name}</h3>
              <button type="button" onClick={() => ref.current?.close()} className="h-9 rounded-md border border-line-strong bg-surface px-3 text-sm font-medium">Close</button>
            </div>
            {movement ? <MovementFigure movement={movement} /> : <StillsFade src={still!} name={name} />}
          </div>
        )}
      </dialog>
    </>
  );
}
