import { describe, expect, it } from "vitest";
import { cleanCalendarUrl, fetchCalendar, isPrivateIp, looksLikeMatch, matchDates, parseIcs } from "./calendar";

const ICS = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20261011", "SUMMARY:Reading v City (H)", "END:VEVENT",
  "BEGIN:VEVENT", "DTSTART:20261014T190000Z", "SUMMARY:League Cup\\, away at Stoke", "END:VEVENT",
  "BEGIN:VEVENT", "DTSTART;TZID=Europe/London:20261016T100000", "SUMMARY:Gym session", "END:VEVENT",
  "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20261018", "SUMMARY:Derby ", " (cancelled soon)", "STATUS:CANCELLED", "END:VEVENT",
  "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20261025", "SUMMARY:Match: U21 vs Forest", "END:VEVENT",
  "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20261101", "SUMMARY:Staff meeting", "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("calendar", () => {
  it("reads events with date-only, UTC and zoned starts, and skips cancelled ones", () => {
    const e = parseIcs(ICS);
    expect(e.map((x) => x.date)).toEqual(["2026-10-11", "2026-10-14", "2026-10-16", "2026-10-25", "2026-11-01"]);
    expect(e[1].summary).toBe("League Cup, away at Stoke");
  });
  it("takes match-like events and leaves training and meetings", () => {
    const r = matchDates(parseIcs(ICS), "2026-10-03");
    expect(r.dates).toEqual(["2026-10-11", "2026-10-14", "2026-10-25"]);
    expect(looksLikeMatch("Gym session")).toBe(false);
    expect(looksLikeMatch("Training v Reserves")).toBe(true);
    expect(looksLikeMatch("Staff meeting")).toBe(false);
  });
  it("refuses links that are not public https", () => {
    expect(cleanCalendarUrl("http://example.com/a.ics")).toBeNull();
    expect(cleanCalendarUrl("https://localhost/a.ics")).toBeNull();
    expect(cleanCalendarUrl("https://127.0.0.1/a.ics")).toBeNull();
    expect(cleanCalendarUrl("https://user:pw@example.com/a.ics")).toBeNull();
    expect(cleanCalendarUrl("https://example.com:8443/a.ics")).toBeNull();
    expect(cleanCalendarUrl("webcal://example.com/a.ics")?.protocol).toBe("https:");
    expect(isPrivateIp("169.254.169.254")).toBe(true);
    expect(isPrivateIp("10.1.2.3")).toBe(true);
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
  });
  it("reports a clear error for a page that is not a calendar", async () => {
    const f = (async () => ({ ok: true, text: async () => "<html></html>" })) as unknown as typeof fetch;
    expect(await fetchCalendar("https://example.com/x", f)).toHaveProperty("error");
    const g = (async () => ({ ok: true, text: async () => ICS })) as unknown as typeof fetch;
    expect(await fetchCalendar("webcal://example.com/x.ics", g)).toHaveProperty("events");
  });
});
