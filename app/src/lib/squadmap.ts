import { standing, usualRange } from "./baseline";

// One player's day against their own usual, for the squad map. Each answer is compared with the same player's other days
// (the day itself left out, so one bad night cannot hide inside its own average). It describes; it decides nothing.
export type Answer = { sleep_h: number | null; soreness: number | null; stress: number | null } | null;
export type Level = "none" | "building" | "usual" | "watch" | "off";
export type Cell = { level: Level; notes: string[] };

const MEASURES: { key: "sleep_h" | "soreness" | "stress"; label: string; room: number; bad: "lower" | "higher"; unit: string }[] = [
  { key: "sleep_h", label: "sleep", room: 0.5, bad: "lower", unit: " h" },
  { key: "soreness", label: "soreness", room: 1, bad: "higher", unit: "" },
  { key: "stress", label: "stress", room: 1, bad: "higher", unit: "" },
];

export function cellsFor(days: Answer[]): Cell[] {
  return days.map((a, i) => {
    if (!a) return { level: "none" as const, notes: [] };
    const notes: string[] = [];
    let known = 0;
    let off = 0;
    for (const m of MEASURES) {
      const today = a[m.key];
      if (today === null) continue;
      const earlier = days.filter((_, j) => j !== i).map((d) => d?.[m.key] ?? null);
      const usual = usualRange(earlier, m.room);
      const st = standing(today, usual);
      if (st === null) continue;
      known++;
      if (st === m.bad) {
        off++;
        notes.push(`${m.label} ${today}${m.unit} (usual ${usual!.low} to ${usual!.high})`);
      }
    }
    if (known === 0) return { level: "building" as const, notes: [] };
    return { level: off === 0 ? ("usual" as const) : off === 1 ? ("watch" as const) : ("off" as const), notes };
  });
}

const SCORE: Record<Level, number | null> = { none: null, building: null, usual: 0, watch: 1, off: 2 };

// "worse" when the last three answers sit clearly above the three before; "quiet" when nothing has been answered for three days.
export function trendOf(cells: Cell[]): "worse" | "better" | "steady" | "quiet" {
  const last3 = cells.slice(-3);
  // Quiet means someone who used to answer and has stopped. A player who has never answered is new, not quiet.
  if (last3.every((c) => c.level === "none")) return cells.slice(0, -3).some((c) => c.level !== "none") ? "quiet" : "steady";
  const nums = (cs: Cell[]) => cs.map((c) => SCORE[c.level]).filter((x): x is number => x !== null);
  const recent = nums(last3), before = nums(cells.slice(-6, -3));
  if (recent.length < 2 || before.length < 2) return "steady";
  const avg = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
  const d = avg(recent) - avg(before);
  return d >= 0.6 ? "worse" : d <= -0.6 ? "better" : "steady";
}

export const todayLevel = (cells: Cell[]): Level => cells[cells.length - 1]?.level ?? "none";

// Share of the players who answered that day who were off their usual on at least one measure.
export function squadShare(rows: Cell[][], dayIndex: number): { answered: number; off: number } {
  const here = rows.map((r) => r[dayIndex]).filter((c) => c && c.level !== "none");
  return { answered: here.length, off: here.filter((c) => c.level === "watch" || c.level === "off").length };
}
