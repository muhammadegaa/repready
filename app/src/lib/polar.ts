import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { deletePolarLink, getPolarLink, patchPolarLink, saveReadiness, type ReadinessRow } from "./store";

// Polar AccessLink v3 (https://www.polar.com/accesslink-api/). The three URLs can be overridden for local testing.
const AUTH_URL = () => process.env.POLAR_AUTH_URL ?? "https://flow.polar.com/oauth2/authorization";
const TOKEN_URL = () => process.env.POLAR_TOKEN_URL ?? "https://polarremote.com/v2/oauth2/token";
const API_URL = () => process.env.POLAR_API_URL ?? "https://www.polaraccesslink.com/v3";

export const polarEnabled = () => Boolean(process.env.POLAR_CLIENT_ID && process.env.POLAR_CLIENT_SECRET);
const clientId = () => process.env.POLAR_CLIENT_ID ?? "";
const clientSecret = () => process.env.POLAR_CLIENT_SECRET ?? "";

export const redirectUri = (origin: string) => process.env.POLAR_REDIRECT_URI ?? `${origin}/api/polar/callback`;

// ---- state: ties the OAuth round trip to one athlete and one browser
const mac = (payload: string) => createHmac("sha256", clientSecret()).update(payload).digest("hex").slice(0, 32);

export const newNonce = () => randomBytes(8).toString("hex");

export function signState(code: string, nonce: string, now = Date.now()): string {
  const payload = `${code}.${nonce}.${now}`;
  return `${payload}.${mac(payload)}`;
}

export function verifyState(state: string, nonce: string | undefined, now = Date.now()): string | null {
  const parts = state.split(".");
  if (parts.length !== 4 || !nonce) return null;
  const [code, n, ts, tag] = parts;
  const expected = mac(`${code}.${n}.${ts}`);
  const a = Buffer.from(tag), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (n !== nonce || !/^[0-9a-f]{16}$/.test(code)) return null;
  if (now - Number(ts) > 15 * 60_000 || now < Number(ts)) return null;
  return code;
}

export function authorizeUrl(code: string, nonce: string, origin: string): string {
  const u = new URL(AUTH_URL());
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", clientId());
  u.searchParams.set("redirect_uri", redirectUri(origin));
  u.searchParams.set("scope", "accesslink.read_all");
  u.searchParams.set("state", signState(code, nonce));
  return u.toString();
}

// ---- API calls
export class PolarAuthError extends Error {}

async function api(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_URL()}${path}`, {
    ...init,
    headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
}

export async function exchangeCode(authCode: string, origin: string): Promise<{ access_token: string; x_user_id: number | null }> {
  const res = await fetch(TOKEN_URL(), {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId()}:${clientSecret()}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json;charset=UTF-8",
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code: authCode, redirect_uri: redirectUri(origin) }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; x_user_id?: number; error?: string };
  if (!res.ok || !body.access_token) throw new Error(`Polar token exchange failed${body.error ? `: ${body.error}` : ` (${res.status})`}`);
  return { access_token: body.access_token, x_user_id: typeof body.x_user_id === "number" ? body.x_user_id : null };
}

// Registering links the Polar user to this athlete. 409 means already registered, which is fine.
export async function registerUser(token: string, memberId: string): Promise<void> {
  const res = await api("/users", token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ "member-id": memberId }) });
  if (res.status !== 200 && res.status !== 409) throw new Error(`Polar registration failed (${res.status})`);
}

export async function deregister(code: string): Promise<void> {
  const link = await getPolarLink(code);
  if (!link?.polar_user_id) return;
  await api(`/users/${link.polar_user_id}`, link.access_token, { method: "DELETE" }).catch(() => undefined);
}

// ---- mapping (pure)
export type PolarNight = {
  date?: string;
  light_sleep?: number; deep_sleep?: number; rem_sleep?: number; unrecognized_sleep_stage?: number;
  total_interruption_duration?: number; sleep_start_time?: string; sleep_end_time?: string;
  heart_rate_samples?: Record<string, number>;
};
export type PolarRecharge = { date?: string; heart_rate_variability_avg?: number };

const hoursOf = (n: PolarNight): number | null => {
  const stages = [n.light_sleep, n.deep_sleep, n.rem_sleep, n.unrecognized_sleep_stage].filter((x): x is number => typeof x === "number");
  let seconds = stages.reduce((a, b) => a + b, 0);
  if (!seconds && n.sleep_start_time && n.sleep_end_time) {
    seconds = (Date.parse(n.sleep_end_time) - Date.parse(n.sleep_start_time)) / 1000 - (n.total_interruption_duration ?? 0);
  }
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const h = Math.round((seconds / 3600) * 10) / 10;
  return h > 0 && h <= 16 ? h : null;
};

const lowestHr = (n: PolarNight): number | null => {
  const v = Object.values(n.heart_rate_samples ?? {}).filter((x) => typeof x === "number" && x > 25 && x < 140);
  return v.length ? Math.min(...v) : null;
};

export function toReadiness(nights: PolarNight[], recharges: PolarRecharge[]): Map<string, ReadinessRow> {
  const hrv = new Map(recharges.filter((r) => r.date && typeof r.heart_rate_variability_avg === "number").map((r) => [r.date!, Math.round(r.heart_rate_variability_avg!)]));
  const out = new Map<string, ReadinessRow>();
  for (const n of nights) {
    if (!n.date || !/^\d{4}-\d{2}-\d{2}$/.test(n.date)) continue;
    const sleep_h = hoursOf(n);
    if (sleep_h === null) continue;
    out.set(n.date, { sleep_h, hrv_ms: hrv.get(n.date) ?? null, resting_hr: lowestHr(n), provider: "polar" });
  }
  return out;
}

// ---- sync
export async function syncPolar(code: string): Promise<{ ok: boolean; nights: number; message: string }> {
  const link = await getPolarLink(code);
  if (!link) return { ok: false, nights: 0, message: "Polar is not connected." };
  try {
    const sleepRes = await api("/users/sleep", link.access_token);
    if (sleepRes.status === 401) throw new PolarAuthError("Polar access was revoked.");
    if (sleepRes.status === 429) return { ok: false, nights: 0, message: "Polar asked us to slow down. Try again in a few minutes." };
    const nights = sleepRes.ok && sleepRes.status !== 204 ? (((await sleepRes.json()) as { nights?: PolarNight[] }).nights ?? []) : [];
    const rechargeRes = await api("/users/nightly-recharge", link.access_token);
    const recharges = rechargeRes.ok && rechargeRes.status !== 204 ? (((await rechargeRes.json()) as { recharges?: PolarRecharge[] }).recharges ?? []) : [];
    const map = toReadiness(nights, recharges);
    for (const [date, row] of map) await saveReadiness(code, date, row);
    await patchPolarLink(code, { last_synced_at: new Date().toISOString(), error: null });
    return { ok: true, nights: map.size, message: map.size ? `Synced ${map.size} night${map.size === 1 ? "" : "s"}.` : "Connected, but Polar has no sleep yet. Sync your device in the Polar Flow app, then try again." };
  } catch (e) {
    const message = e instanceof PolarAuthError ? "Polar access was revoked. Reconnect to continue." : `Could not reach Polar: ${(e as Error).message}`;
    if (e instanceof PolarAuthError) await patchPolarLink(code, { error: message });
    return { ok: false, nights: 0, message };
  }
}

export async function disconnectPolar(code: string): Promise<void> {
  await deregister(code);
  await deletePolarLink(code);
}
