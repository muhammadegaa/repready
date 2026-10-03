import { fetchCalendar, matchDates } from "./calendar";
import { todayStr } from "./run-agent";
import { getCalendarLink, saveCalendarLink } from "./store";

// Reads the club's calendar again and keeps what it found. A failed read keeps the last good dates and records why.
export async function syncCalendar(club: string): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const link = await getCalendarLink(club);
  if (!link) return { ok: false, error: "No calendar link is saved." };
  const got = await fetchCalendar(link.url);
  const now = new Date().toISOString();
  if ("error" in got) {
    await saveCalendarLink(club, { ...link, error: got.error });
    return { ok: false, error: got.error };
  }
  const { dates, taken } = matchDates(got.events, todayStr());
  await saveCalendarLink(club, { url: link.url, synced_at: now, dates, examples: taken.slice(0, 5).map((e) => `${e.date} ${e.summary}`), error: null });
  return { ok: true, count: dates.length };
}
