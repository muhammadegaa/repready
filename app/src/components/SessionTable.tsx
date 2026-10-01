import { applyEdits } from "@/lib/agent/apply";
import type { Edit, Exercise } from "@/lib/agent/schema";
import { Mark } from "./ui";

// The session as a whiteboard: planned values stay plain, changed values are struck through and highlighted.
export function SessionTable({ planned, edits = [], muted = false }: { planned: Exercise[]; edits?: Edit[]; muted?: boolean }) {
  const shown = applyEdits(planned, edits);
  return (
    <div className={`overflow-x-auto rounded-lg border border-line ${muted ? "opacity-60" : ""}`}>
      <table className="w-full min-w-[320px] text-sm">
        <thead>
          <tr className="border-b border-line bg-paper text-left font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
            <th className="px-3 py-2 font-medium">Exercise</th>
            <th className="px-3 py-2 font-medium">Sets × reps</th>
            <th className="px-3 py-2 font-medium">Load</th>
          </tr>
        </thead>
        <tbody>
          {planned.map((p, i) => {
            const s = shown[i];
            return (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="px-3 py-2.5 font-medium">
                  {s.name !== p.name ? (<><s className="mr-1.5 font-normal text-muted">{p.name}</s><Mark>{s.name}</Mark></>) : p.name}
                </td>
                <td className="px-3 py-2.5 font-mono tabular-nums">
                  {s.sets !== p.sets ? (<><s className="mr-1 text-muted">{p.sets}</s><Mark>{s.sets}</Mark></>) : p.sets}
                  <span className="text-muted"> × </span>
                  {s.reps !== p.reps ? (<><s className="mr-1 text-muted">{p.reps}</s><Mark>{s.reps}</Mark></>) : p.reps}
                </td>
                <td className="px-3 py-2.5 font-mono text-[13px]">
                  {s.load !== p.load ? (<><s className="mr-1.5 text-muted">{p.load}</s><Mark>{s.load}</Mark></>) : p.load}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
