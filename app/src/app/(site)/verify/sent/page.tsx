import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Check your email" };
export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  sent: "We sent a link. It can take a minute to arrive. Check spam if you do not see it.",
  throttled: "A link was sent a moment ago. Give it a minute, then ask again if it has not arrived.",
  done: "This address is already confirmed.",
  failed: "We could not send the email right now. Try again in a few minutes.",
};

export default async function Sent(props: PageProps<"/verify/sent">) {
  const s = await getSession();
  if (!s) redirect("/signin");
  const { r } = await props.searchParams;
  return (
    <div className="mx-auto max-w-sm pt-10">
      <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
      <Card className="mt-6 space-y-3 p-5 text-sm">
        <p>{MESSAGES[typeof r === "string" ? r : ""] ?? MESSAGES.sent}</p>
        <Link href="/coach" className="font-medium underline underline-offset-4">Back to RepReady</Link>
      </Card>
    </div>
  );
}
