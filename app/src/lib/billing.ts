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
