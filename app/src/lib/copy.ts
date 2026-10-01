export const DECISION: Record<string, { title: string; approve: string; athlete: string }> = {
  reduce: { title: "Reduce today's volume", approve: "Approve", athlete: "Your coach adjusted today's session." },
  swap: { title: "Swap an exercise", approve: "Approve", athlete: "Your coach swapped an exercise in today's session." },
  rest: { title: "Rest today", approve: "Confirm rest day", athlete: "Your coach says rest today." },
  flag_only: { title: "Check before training", approve: "Send to athlete", athlete: "Your coach wants a word before you train." },
  increase: { title: "Room to progress", approve: "Send to athlete", athlete: "Your coach reviewed your check-in." },
  none: { title: "No change", approve: "OK", athlete: "Planned session, no change." },
};

export const decisionCopy = (d: string | null) => DECISION[d ?? "none"] ?? DECISION.none;

export function dateLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
