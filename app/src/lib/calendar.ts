import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
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

// The address is resolved inside the connection itself and checked there, so a name that answers with a public address first and a
// private one a moment later cannot slip past a check made earlier.
function guardedLookup(hostname: string, options: { all?: boolean }, cb: (err: Error | null, address?: unknown, family?: number) => void) {
  dnsLookup(hostname, { all: true }).then(
    (addrs) => {
      if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) return cb(new Error("not a public address"));
      if (options?.all) cb(null, addrs);
      else cb(null, addrs[0].address, addrs[0].family);
    },
    (e) => cb(e as Error),
  );
}

function getPublic(u: URL): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      { protocol: "https:", hostname: u.hostname, port: 443, path: u.pathname + u.search, method: "GET", lookup: guardedLookup as never, timeout: 10_000, headers: { Accept: "text/calendar, text/plain, */*" } },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => { size += c.length; if (size > MAX_BYTES) { req.destroy(); reject(new Error("too large")); } else chunks.push(c); });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(Object.assign(new Error("timeout"), { name: "TimeoutError" })));
    req.on("error", reject);
    req.end();
  });
}

export async function fetchCalendar(raw: string, f?: typeof fetch): Promise<{ events: CalEvent[] } | { error: string }> {
  const u = cleanCalendarUrl(raw);
  if (!u) return { error: "That does not look like a calendar link. It should start with https:// or webcal:// and end in .ics or be a share link from your calendar." };
  try {
    let status: number, text: string;
    if (f) {
      const res = await f(u, { redirect: "error", signal: AbortSignal.timeout(10_000) });
      status = res.ok ? 200 : res.status;
      text = res.ok ? (await res.text()).slice(0, MAX_BYTES) : "";
    } else ({ status, text } = await getPublic(u));
    if (status < 200 || status >= 300) return { error: `The calendar did not open (it answered ${status}). Check the link is the public or secret address of the calendar.` };
    if (!/BEGIN:VCALENDAR/i.test(text)) return { error: "That link did not give a calendar. Look for “Secret address in iCal format” or “Export” in your calendar settings." };
    return { events: parseIcs(text) };
  } catch (e) {
    const m = (e as Error).message;
    if ((e as Error).name === "TimeoutError" || m === "timeout") return { error: "The calendar took too long to answer." };
    if (m === "not a public address") return { error: "That address is not a public website, so it cannot be a calendar link." };
    return { error: "The calendar could not be reached." };
  }
}
