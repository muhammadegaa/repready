import Image from "next/image";
import { applyEdits } from "@/lib/agent/apply";
import type { Edit, Exercise } from "@/lib/agent/schema";
import { imageForName } from "@/lib/library";
import { movementFor } from "@/lib/movement";
import { ShowMe } from "./movement/ShowMe";
import { Mark } from "./ui";

// The session as a whiteboard: planned values stay plain, changed values are struck through and highlighted.
export function SessionTable({ planned, edits = [], muted = false, pictures = false, tags = {} }: { planned: Exercise[]; edits?: Edit[]; muted?: boolean; pictures?: boolean; tags?: Record<string, string> }) {
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
                  <div className="flex items-center gap-2.5">
                    {pictures && <Thumb name={s.name} />}
                    <div>
                      {s.name !== p.name ? (<><s className="mr-1.5 font-normal text-muted">{p.name}</s><Mark>{s.name}</Mark></>) : p.name}
                      {tags[p.name] ? <div className="mt-0.5 text-[11px] font-normal text-muted">{tags[p.name]}</div> : null}
                      {pictures && <ShowMe name={s.name} movement={movementFor(s.name)} still={imageForName(s.name)} />}
                    </div>
                  </div>
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

// A small picture when the library has one for this exact exercise; otherwise nothing, so no row ever shows a wrong picture.
function Thumb({ name }: { name: string }) {
  const src = imageForName(name);
  if (!src) return <span aria-hidden className="h-10 w-10 shrink-0" />;
  return <Image src={src} alt="" width={40} height={40} unoptimized loading="lazy" className="h-10 w-10 shrink-0 rounded-md border border-line bg-paper object-cover" />;
}
