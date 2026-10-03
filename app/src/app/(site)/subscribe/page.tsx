import { redirect } from "next/navigation";
import { btn, Card } from "@/components/ui";
import { checkoutUrl } from "@/lib/billing";
import { getSession, homeFor } from "@/lib/auth";

export const metadata = { title: "Subscribe" };
export const dynamic = "force-dynamic";

export default async function Subscribe() {
  const s = await getSession();
  if (!s) redirect("/signin");
  if (s.access) redirect(homeFor(s));
  const url = checkoutUrl(s.club, s.email);
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
