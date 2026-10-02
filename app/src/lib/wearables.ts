import { createHmac, timingSafeEqual } from "node:crypto";

export type Readiness = {
  sleep_h: number | null;
  hrv_ms: number | null;
  resting_hr: number | null;
  provider: string;
};

const NAMES: Record<string, string> = {
  whoop: "WHOOP",
  garmin: "Garmin",
  oura: "Oura",
  fitbit: "Fitbit",
  polar: "Polar",
  apple_health: "Apple Watch",
};

export const providerName = (provider: string) => NAMES[provider] ?? provider;

export const PREVIEW: Record<string, Readiness> = {
  whoop: { sleep_h: 5.4, hrv_ms: 41, resting_hr: 58, provider: "whoop" },
  garmin: { sleep_h: 6.8, hrv_ms: 62, resting_hr: 52, provider: "garmin" },
  oura: { sleep_h: 7.2, hrv_ms: 48, resting_hr: 54, provider: "oura" },
  fitbit: { sleep_h: 6.1, hrv_ms: 36, resting_hr: 61, provider: "fitbit" },
  polar: { sleep_h: 7.0, hrv_ms: 55, resting_hr: 50, provider: "polar" },
};

function hours(n: unknown): number | null {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return null;
  const h = n > 24 ? n / 3600 : n;
  if (h > 16) return null;
  return Math.round(h * 10) / 10;
}

function num(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n) : null;
}

export function fromJunctionSleep(body: unknown): { athleteCode: string; date: string; readiness: Readiness } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const event = String(b.event_type ?? "");
  if (event && !event.startsWith("daily.data.sleep")) return null;
  const data = b.data && typeof b.data === "object" ? (b.data as Record<string, unknown>) : null;
  if (!data) return null;
  const code = String(b.client_user_id ?? "");
  const date = String(data.calendar_date ?? "").slice(0, 10);
  if (!/^[0-9a-f]{16}$/.test(code) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const source = data.source && typeof data.source === "object" ? (data.source as Record<string, unknown>).provider : null;
  const provider = String(source ?? "wearable").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 40) || "wearable";
  return {
    athleteCode: code,
    date,
    readiness: {
      sleep_h: hours(data.total) ?? hours(data.duration),
      hrv_ms: num(data.average_hrv),
      resting_hr: num(data.hr_lowest),
      provider,
    },
  };
}

export function verifyJunction(raw: string, headers: Headers): boolean {
  const secret = process.env.JUNCTION_WEBHOOK_SECRET;
  if (!secret) return false;
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signature = headers.get("svix-signature");
  if (!id || !timestamp || !signature) return false;
  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${raw}`).digest("base64");
  const match = signature.split(" ").some((part) => {
    const value = part.startsWith("v1,") ? part.slice(3) : "";
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
  return match;
}
