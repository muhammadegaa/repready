import Link from "next/link";
import { notFound } from "next/navigation";
import { LabelForm } from "@/components/LabelForm";
import { Live } from "@/components/Live";
import { SessionTable } from "@/components/SessionTable";
import { Card, Chip, Eyebrow } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { activeRules, allRules } from "@/lib/rules";
import { SCENARIOS, scenarioById } from "@/lib/scenarios";
import { getPulse, listLabels } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/science/label/[id]">) {
  const { id } = await props.params;
  return { title: `Label ${id}` };
}

export default async function Label(props: PageProps<"/science/label/[id]">) {
  const { club } = await requirePage("scientist");
  const { id } = await props.params;
  const s = scenarioById(id);
  if (!s) notFound();
  const [labels, rules, pulse] = await Promise.all([listLabels(club), allRules(club), getPulse(club, "science")]);
  const label = labels.find((l) => l.id === id) ?? null;
  const i = SCENARIOS.findIndex((x) => x.id === id);
  const prev = SCENARIOS[i - 1], next = SCENARIOS[i + 1];
  const a = s.athlete;

  return (
    <div className="space-y-8">
      <Live scope="science" initial={pulse} />
      <header className="space-y-3">
        <Link href="/science/evaluation" className="text-sm text-muted hover:text-ink">← Evaluation</Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">{s.id}</h1>
            <span className="text-muted">{i + 1} of {SCENARIOS.length}</span>
            {s.holdout && <Chip>Held out</Chip>}
            {label && <Chip tone="ok">Labeled</Chip>}
          </div>
          <div className="flex gap-2 text-sm">
            {prev && <Link href={`/science/label/${prev.id}`} className="rounded-md border border-line-strong bg-surface px-3 py-1.5 font-medium hover:bg-paper">← {prev.id}</Link>}
            {next && <Link href={`/science/label/${next.id}`} className="rounded-md border border-line-strong bg-surface px-3 py-1.5 font-medium hover:bg-paper">{next.id} →</Link>}
          </div>
        </div>
        <p className="text-muted">Fictional player, plausible numbers, not measured. Decide what you would do as the coach, and save before you open the rule tags.</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <section className="space-y-3">
            <Eyebrow>Player</Eyebrow>
            <Card className="px-5 py-4 text-sm">{a.sport} · {a.level} · {a.training_age_years} years training · adult</Card>
          </section>
          <section className="space-y-3">
            <Eyebrow>Planned session · {s.planned_session.label}{s.planned_session.week_type === "deload" ? " (deload week)" : ""}</Eyebrow>
            <SessionTable planned={s.planned_session.exercises} />
          </section>
          <section className="space-y-3">
            <Eyebrow>Last 14 days</Eyebrow>
            <div className="overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full min-w-[520px] text-sm">
                <thead><tr className="border-b border-line bg-paper text-left font-mono text-[11px] uppercase tracking-[0.12em] text-muted"><th className="px-3 py-2 font-medium">Day</th><th className="px-3 py-2 font-medium">Sleep h</th><th className="px-3 py-2 font-medium">Soreness</th><th className="px-3 py-2 font-medium">Stress</th><th className="px-3 py-2 font-medium">Effort vs plan</th><th className="px-3 py-2 font-medium">Note</th></tr></thead>
                <tbody>
                  {s.last_14_days.map((d) => {
                    const regions = Object.entries(d.soreness.by_region).map(([k, v]) => `${k} ${v}`).join(", ");
                    return (
                      <tr key={d.day} className={`border-b border-line last:border-0 ${d.day === 0 ? "bg-paper font-medium" : ""}`}>
                        <td className="px-3 py-2 font-mono text-xs">{d.day === 0 ? "today" : d.day}</td>
                        <td className="px-3 py-2 font-mono tabular-nums">{d.sleep_h}</td>
                        <td className="px-3 py-2 font-mono tabular-nums">{d.soreness.overall}{regions && <span className="text-xs text-muted"> ({regions})</span>}</td>
                        <td className="px-3 py-2 font-mono tabular-nums">{d.stress}</td>
                        <td className="px-3 py-2 font-mono tabular-nums">{d.session ? (d.session.rpe_delta > 0 ? `+${d.session.rpe_delta}` : d.session.rpe_delta) : "–"}</td>
                        <td className="px-3 py-2 text-bad">{d.note}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">Effort vs plan: session RPE minus the target RPE. A dash is no session that day.</p>
          </section>
        </div>

        <section className="min-w-0 space-y-3">
          <Eyebrow>Your label</Eyebrow>
          <Card className="p-5"><LabelForm key={label?.labeled_at ?? "new"} id={s.id} planned={s.planned_session.exercises} label={label} rules={activeRules(rules)} /></Card>
        </section>
      </div>
    </div>
  );
}
