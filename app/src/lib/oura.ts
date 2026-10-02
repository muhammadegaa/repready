import type { ReadinessRow } from "./store";

// Oura API v2, sleep documents (https://cloud.ouraring.com/v2/docs).
// NOT VERIFIED against the live API: written from the documented fields, and the sandbox host was unreachable when this was written.
export type OuraSleep = {
  day?: string;
  type?: string; // long_sleep | late_nap | rest | sleep | deleted
  total_sleep_duration?: number | null; // seconds
  average_hrv?: number | null; // ms
  lowest_heart_rate?: number | null; // bpm
};

const API = () => process.env.OURA_API_URL ?? "https://api.ouraring.com/v2";

// One row per day, from that day's main sleep. Naps and deleted sessions never count as the night.
export function ouraToReadiness(docs: OuraSleep[]): Map<string, ReadinessRow> {
  const best = new Map<string, OuraSleep>();
  for (const d of docs) {
    if (!d.day || !/^\d{4}-\d{2}-\d{2}$/.test(d.day) || d.type !== "long_sleep") continue;
    const prev = best.get(d.day);
    if (!prev || (d.total_sleep_duration ?? 0) > (prev.total_sleep_duration ?? 0)) best.set(d.day, d);
  }
  const out = new Map<string, ReadinessRow>();
  for (const [day, d] of best) {
    const s = d.total_sleep_duration;
    const sleep_h = typeof s === "number" && s > 0 && s / 3600 <= 16 ? Math.round((s / 3600) * 10) / 10 : null;
    if (sleep_h === null) continue;
    out.set(day, {
      sleep_h,
      hrv_ms: typeof d.average_hrv === "number" && d.average_hrv > 0 ? Math.round(d.average_hrv) : null,
      resting_hr: typeof d.lowest_heart_rate === "number" && d.lowest_heart_rate > 25 && d.lowest_heart_rate < 140 ? Math.round(d.lowest_heart_rate) : null,
      provider: "oura",
    });
  }
  return out;
}

// sandbox=true hits Oura's fake-data endpoints, which need no ring. Follows next_token pages.
export async function fetchOuraSleep(token: string, start: string, end: string, sandbox = false): Promise<OuraSleep[]> {
  const out: OuraSleep[] = [];
  let next: string | undefined;
  for (let page = 0; page < 5; page++) {
    const u = new URL(`${API()}/${sandbox ? "sandbox/" : ""}usercollection/sleep`);
    u.searchParams.set("start_date", start);
    u.searchParams.set("end_date", end);
    if (next) u.searchParams.set("next_token", next);
    const res = await fetch(u, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (res.status === 401) throw new Error("Oura access was revoked or the token is invalid.");
    if (res.status === 429) throw new Error("Oura asked us to slow down.");
    if (!res.ok) throw new Error(`Oura returned ${res.status}`);
    const body = (await res.json()) as { data?: OuraSleep[]; next_token?: string | null };
    out.push(...(body.data ?? []));
    if (!body.next_token) break;
    next = body.next_token;
  }
  return out;
}
