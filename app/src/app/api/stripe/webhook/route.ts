import { NextResponse } from "next/server";
import { paidClubFrom, verifyStripe } from "@/lib/billing";
import { markClubPaid } from "@/lib/store";

export const dynamic = "force-dynamic";

// Stripe tells us a payment completed; the payment link carries the club in client_reference_id.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const body = await req.text();
  if (!verifyStripe(body, req.headers.get("stripe-signature"), secret)) {
    console.error("[stripe webhook] signature did not match: STRIPE_WEBHOOK_SECRET belongs to a different endpoint or mode.");
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }
  let event: unknown;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  const club = paidClubFrom(event);
  if (club) console.log(`[stripe webhook] club ${club} ${(await markClubPaid(club)) ? "marked paid" : "not found"}`);
  else console.log(`[stripe webhook] ignored ${(event as { type?: string })?.type ?? "event"}`);
  return NextResponse.json({ received: true });
}
