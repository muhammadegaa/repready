import { redirect } from "next/navigation";
import { btn, Card } from "@/components/ui";
import { checkoutPaidFor, checkoutUrl } from "@/lib/billing";
import { markClubPaid } from "@/lib/store";
import { getSession, homeFor } from "@/lib/auth";

export const metadata = { title: "Subscribe" };
export const dynamic = "force-dynamic";

export default async function Subscribe(props: PageProps<"/subscribe">) {
  const s = await getSession();
  if (!s) redirect("/signin");
  if (s.access) redirect(homeFor(s));
  // Stripe sends the buyer back here with the checkout session id. Ask Stripe directly, so the club opens even before the webhook lands.
  const { session_id } = await props.searchParams;
  const returning = typeof session_id === "string";
  if (returning && (await checkoutPaidFor(session_id, s.club))) {
    await markClubPaid(s.club);
    redirect(homeFor(s));
  }
  const url = checkoutUrl(s.club, s.email);
  if (returning) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-10">
        <meta httpEquiv="refresh" content="4" />
        <h1 className="text-3xl font-semibold tracking-tight">Payment received</h1>
        <p className="text-muted">We are waiting for Stripe to confirm it. This page checks again every few seconds and opens {s.clubName} as soon as it does.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-xl space-y-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">One step left</h1>
      <p className="text-muted">{s.clubName} is set up. Subscribe to start adding players and sending check-ins. Your account, squad and settings are kept.</p>
      <Card className="space-y-3 p-5">
        {url ? (
          <>
            <a href={url} className={btn}>Subscribe</a>
            <p className="text-xs text-muted">Payment is taken by Stripe. When it completes this page opens your club. If it does not within a minute, refresh it.</p>
          </>
        ) : (
          <p className="text-sm text-warn">Payment is not available right now. Please contact us and we will open your club.</p>
        )}
      </Card>
    </div>
  );
}
