import type { RosterEntry } from "./views";

// The morning email. It names people and counts but carries no notes, scores or health detail: that stays behind the sign-in.
export function buildDigest(opts: { clubName: string; date: string; sessionLabel: string | null; roster: RosterEntry[]; appUrl: string }): { subject: string; text: string } {
  const { roster } = opts;
  const first = (e: RosterEntry) => e.athlete.name;
  const needs = roster.filter((r) => r.status === "needs_decision");
  const notIn = roster.filter((r) => r.status === "waiting");
  const errors = roster.filter((r) => r.status === "agent_error");
  const checked = roster.filter((r) => r.checkin).length;

  const lines: string[] = [];
  lines.push(opts.sessionLabel ? `Today's session: ${opts.sessionLabel}.` : "No session is scheduled today.");
  lines.push(`${checked} of ${roster.length} players have checked in.`);
  lines.push("");
  lines.push(needs.length ? `Need your decision (${needs.length}): ${needs.map(first).join(", ")}.` : "Nothing is waiting on your decision.");
  if (errors.length) lines.push(`No suggestion could be made for: ${errors.map(first).join(", ")}. Check them yourself.`);
  if (notIn.length) lines.push(`Not checked in (${notIn.length}): ${notIn.map(first).join(", ")}.`);
  lines.push("");
  lines.push(`Open RepReady: ${opts.appUrl}/coach`);
  lines.push("");
  lines.push("This email names players but contains no health information. Details are behind your sign-in.");

  const flag = needs.length ? ` · ${needs.length} need you` : "";
  return { subject: `${opts.clubName} ${opts.date}${flag}`, text: lines.join("\n") };
}
