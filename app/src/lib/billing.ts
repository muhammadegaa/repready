import { createHmac, timingSafeEqual } from "node:crypto";

// The product is gated by one Stripe payment link (NEXT_PUBLIC_PAYMENT_LINK). With no link set there is no gate, which is how
// local development and the tests run. A club gets in once Stripe tells us its payment completed, or when it is on the comped list.
export const paymentLink = () => process.env.NEXT_PUBLIC_PAYMENT_LINK?.trim() || null;

export function hasAccess(club: { id: string; paid_at: string | null }, env: { link: string | null; comped: string | undefined }): boolean {
  if (!env.link) return true;
  if (club.paid_at) return true;
  return (env.comped ?? "").split(",").map((s) => s.trim()).filter(Boolean).includes(club.id);
}

export const clubHasAccess = (club: { id: string; paid_at: string | null }) => hasAccess(club, { link: paymentLink(), comped: process.env.COMPED_CLUBS });

// Stripe's own link, with the club carried through so the payment can be matched to it.
export function checkoutUrl(clubId: string, email: string): string | null {
  const link = paymentLink();
  if (!link) return null;
  try {
    const u = new URL(link);
    u.searchParams.set("client_reference_id", clubId);
    u.searchParams.set("prefilled_email", email);
    return u.toString();
  } catch {
    return null;
  }
}

// Checks Stripe's signature header ("t=...,v1=...") over the raw body, and rejects old deliveries.
export function verifyStripe(body: string, header: string | null, secret: string, now = Date.now(), toleranceSec = 300): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(now / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${parts.t}.${body}`).digest("hex");
  return header.split(",").filter((p) => p.startsWith("v1=")).some((p) => {
    const given = Buffer.from(p.slice(3)), want = Buffer.from(expected);
    return given.length === want.length && timingSafeEqual(given, want);
  });
}

// Returns the club to unlock from a completed, paid checkout, or null for anything else.
export function paidClubFrom(event: unknown): string | null {
  const e = event as { type?: string; data?: { object?: { client_reference_id?: string; payment_status?: string } } };
  if (e?.type !== "checkout.session.completed" && e?.type !== "checkout.session.async_payment_succeeded") return null;
  const o = e.data?.object;
  if (!o || o.payment_status !== "paid" && o.payment_status !== "no_payment_required") return null;
  return /^[0-9a-f]{6}$/.test(o.client_reference_id ?? "") ? o.client_reference_id! : null;
}

// When Stripe sends the buyer back with ?session_id=..., ask Stripe directly whether that checkout was paid and was for this club.
// This works even if the webhook is late or not set up yet. Needs STRIPE_SECRET_KEY; without it only the webhook unlocks a club.
export async function checkoutPaidFor(sessionId: string, clubId: string, f: typeof fetch = fetch): Promise<boolean> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sessionId)) return false;
  try {
    const res = await f(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return false;
    const o = (await res.json()) as { client_reference_id?: string; payment_status?: string };
    return o.client_reference_id === clubId && (o.payment_status === "paid" || o.payment_status === "no_payment_required");
  } catch {
    return false;
  }
}

// The safety net for everything else: look through Stripe's recent checkouts for a completed one that carries this club's id.
// It means a paid club opens even if the redirect was never configured and the webhook never arrived. Needs STRIPE_SECRET_KEY.
export async function findPaidCheckout(clubId: string, f: typeof fetch = fetch): Promise<boolean> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return false;
  try {
    const res = await f("https://api.stripe.com/v1/checkout/sessions?limit=100", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.error(`[billing] Stripe checkout list returned ${res.status}. Check STRIPE_SECRET_KEY has read access to Checkout Sessions, in the same mode as the payment link.`);
      return false;
    }
    const body = (await res.json()) as { data?: { client_reference_id?: string; status?: string; payment_status?: string }[] };
    return (body.data ?? []).some((o) => o.client_reference_id === clubId && o.status === "complete" && (o.payment_status === "paid" || o.payment_status === "no_payment_required"));
  } catch (e) {
    console.error(`[billing] Stripe lookup failed: ${(e as Error).message}`);
    return false;
  }
}
