import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// A club calendar link (Google, Outlook, Apple, TeamSnap, SportMonks exports all give an .ics URL) becomes match dates.
// Only events that look like matches are taken. Reading is done in our own code and the link is fetched with care, because
// the address comes from a user.
export type CalEvent = { date: string; summary: string };

const MATCHY = /(?:^|[\s(\-])(?:v|vs|vs\.|v\.|versus)(?:[\s)]|$)|@|\b(?:match|fixture|game|cup|league|friendly|derby|final)\b/i;
const TRAINING = /\b(training|session|gym|recovery|meeting|physio|medical|analysis|video)\b/i;
export const looksLikeMatch = (summary: string) => MATCHY.test(summary) && !(TRAINING.test(summary) && !/\b(v|vs|versus)\b/i.test(summary));

const unescape = (s: string) => s.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();

export function parseIcs(text: string): CalEvent[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const out: CalEvent[] = [];
  for (const block of unfolded.split(/BEGIN:VEVENT/i).slice(1)) {
    const body = block.split(/END:VEVENT/i)[0];
    if (/^STATUS:CANCELLED/im.test(body)) continue;
    const start = body.match(/^DTSTART[^:\r\n]*:(\d{4})(\d{2})(\d{2})/im);
    const summary = body.match(/^SUMMARY[^:\r\n]*:(.*)$/im)?.[1];
    if (!start || !summary) continue;
    const date = `${start[1]}-${start[2]}-${start[3]}`;
    if (!new Date(`${date}T00:00:00Z`).toISOString().startsWith(date)) continue;
    out.push({ date, summary: unescape(summary).slice(0, 120) });
  }
  return out;
}

export function matchDates(events: CalEvent[], today: string): { dates: string[]; taken: CalEvent[] } {
  const from = new Date(`${today}T00:00:00Z`); from.setUTCDate(from.getUTCDate() - 60);
  const to = new Date(`${today}T00:00:00Z`); to.setUTCDate(to.getUTCDate() + 400);
  const taken = events.filter((e) => looksLikeMatch(e.summary) && e.date >= from.toISOString().slice(0, 10) && e.date <= to.toISOString().slice(0, 10));
  return { dates: [...new Set(taken.map((e) => e.date))].sort(), taken: taken.sort((a, b) => a.date.localeCompare(b.date)) };
}

export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
}

export function cleanCalendarUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim().replace(/^webcal:\/\//i, "https://"));
    if (u.protocol !== "https:" || u.username || u.password || u.port && u.port !== "443") return null;
    if (u.hostname === "localhost" || isIP(u.hostname.replace(/^\[|\]$/g, "")) !== 0 && isPrivateIp(u.hostname.replace(/^\[|\]$/g, ""))) return null;
    return u;
  } catch {
    return null;
  }
}

const MAX_BYTES = 2 * 1024 * 1024;

export async function fetchCalendar(raw: string, f: typeof fetch = fetch): Promise<{ events: CalEvent[] } | { error: string }> {
  const u = cleanCalendarUrl(raw);
  if (!u) return { error: "That does not look like a calendar link. It should start with https:// or webcal:// and end in .ics or be a share link from your calendar." };
  try {
    if (f === fetch) {
      const addrs = await lookup(u.hostname, { all: true });
      if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) return { error: "That address is not a public website, so it cannot be a calendar link." };
    }
    const res = await f(u, { redirect: "error", signal: AbortSignal.timeout(10_000), headers: { Accept: "text/calendar, text/plain, */*" } });
    if (!res.ok) return { error: `The calendar did not open (it answered ${res.status}). Check the link is the public or secret address of the calendar.` };
    const text = (await res.text()).slice(0, MAX_BYTES);
    if (!/BEGIN:VCALENDAR/i.test(text)) return { error: "That link did not give a calendar. Look for “Secret address in iCal format” or “Export” in your calendar settings." };
    return { events: parseIcs(text) };
  } catch (e) {
    return { error: (e as Error).name === "TimeoutError" ? "The calendar took too long to answer." : "The calendar could not be reached." };
  }
}
