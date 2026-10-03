import Link from "next/link";
import { Card } from "@/components/ui";
import { verifyEmail } from "@/lib/store";

export const metadata = { title: "Confirm your email" };
export const dynamic = "force-dynamic";

export default async function Verify(props: PageProps<"/verify/[token]">) {
  const { token } = await props.params;
  const ok = (await verifyEmail(token)) === "ok";
  return (
    <div className="mx-auto max-w-sm pt-10">
      <h1 className="text-2xl font-semibold tracking-tight">{ok ? "Email confirmed" : "That link did not work"}</h1>
      <Card className="mt-6 space-y-3 p-5 text-sm">
        <p>{ok ? "Thank you. You will get the morning digest at this address." : "It has expired, was already used, or the address on the account has changed. Sign in and ask for a new link."}</p>
        <Link href="/coach" className="font-medium underline underline-offset-4">Go to RepReady</Link>
      </Card>
    </div>
  );
}
